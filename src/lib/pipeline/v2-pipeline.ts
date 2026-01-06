// ============================================
// ResumeOS V2: Pipeline Orchestrator
// ============================================
//
// Ties together all 4 agents into a single orchestrated pipeline
// with proper state management and user intervention pause.
//
// Pipeline Flow:
// 1. POST /api/v2/pipeline/start
//    → JD Strategist (Agent 1)
//    → Content Selection (Code)
//    → Gap Analyzer (Agent 2)
//    → Status: "gap-review" ← PAUSES HERE
//
// 2. [User reviews, swaps, approves via UI]
//
// 3. POST /api/v2/pipeline/generate
//    → Resume Writer (Agent 3)
//    → Validator (Agent 4)
//    → Status: "complete" or "failed"

import { db } from '@/lib/db';
import { sessions } from '@/drizzle/schema';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

import { JDStrategistAgent } from '../agents/jd-strategist';
import { GapAnalyzerAgent } from '../agents/gap-analyzer';
import { ResumeWriterAgent } from '../agents/resume-writer';
import { ValidatorAgent } from '../agents/validator';
import { selectContentV2 } from '../content-selector-v2';

import type {
  PipelineSession,
  PipelineDiagnostics,
  PipelineState,
  JDStrategy,
  ContentSelectionResult,
  GapAnalysis,
  WriterOutput,
  ValidationResult,
  AgentDiagnostics,
} from '@/types/v2';

// ============================================
// Types
// ============================================

interface AnalysisPhaseResult {
  sessionId: string;
  state: PipelineState;
  strategy: JDStrategy;
  selection: ContentSelectionResult;
  gapAnalysis: GapAnalysis;
}

interface GenerationPhaseResult {
  sessionId: string;
  state: PipelineState;
  writerOutput: WriterOutput;
  validation: ValidationResult;
}

// ============================================
// Pipeline Orchestrator Class
// ============================================

export class V2Pipeline {
  private sessionId: string;
  private diagnostics: PipelineDiagnostics;
  private startTime: number;

  constructor(sessionId?: string) {
    this.sessionId = sessionId || uuidv4();
    this.startTime = Date.now();
    this.diagnostics = {
      sessionId: this.sessionId,
      pipelineVersion: 'v2',
      timing: {
        totalDurationMs: 0,
        agentTimings: [],
        contentSelectionMs: 0,
      },
      costs: {
        totalUSD: 0,
        byAgent: [],
      },
      agents: {},
    };
  }

  // ============================================
  // Public Methods
  // ============================================

  /**
   * Phase 1: Analyze JD → Select Content → Analyze Gaps
   * Returns at "gap-review" state for user intervention
   */
  async runAnalysisPhase(jobDescription: string): Promise<AnalysisPhaseResult> {
    const phaseStart = Date.now();

    // Initialize session in DB
    await this.initializeSession(jobDescription);

    // Step 1: JD Strategist
    await this.updateState('analyzing');
    const jdAgent = new JDStrategistAgent();
    const { output: strategy, diagnostics: jdDiag } = await jdAgent.run({
      jobDescription,
    });
    this.recordAgentDiagnostics('jdStrategist', jdDiag);

    // Step 2: Content Selection (no LLM)
    await this.updateState('selecting');
    const selectionStart = Date.now();
    const selection = await selectContentV2(strategy);
    this.diagnostics.timing.contentSelectionMs = Date.now() - selectionStart;
    this.diagnostics.contentSelection = {
      signals: strategy.scoringSignals,
      allScores: selection.debug.scoringBreakdown,
      selectedItems: [
        { slotId: 'summary', sourceIds: selection.summary.sources.map((s) => s.id) },
        ...selection.careerHighlights.map((ch) => ({
          slotId: ch.slot,
          sourceIds: ch.sources.map((s) => s.id),
        })),
        {
          slotId: 'p1_overview',
          sourceIds: selection.position1.overview.sources.map((s) => s.id),
        },
        ...selection.position1.bullets.map((b) => ({
          slotId: b.slot,
          sourceIds: b.sources.map((s) => s.id),
        })),
        {
          slotId: 'p2_overview',
          sourceIds: selection.position2.overview.sources.map((s) => s.id),
        },
        ...selection.position2.bullets.map((b) => ({
          slotId: b.slot,
          sourceIds: b.sources.map((s) => s.id),
        })),
        ...selection.positions3to6.map((p) => ({
          slotId: `p${p.position}_overview`,
          sourceIds: p.overview.sources.map((s) => s.id),
        })),
      ],
      conflictsApplied: selection.debug.conflictsApplied,
      durationMs: this.diagnostics.timing.contentSelectionMs,
    };

    // Step 3: Gap Analyzer
    const gapAgent = new GapAnalyzerAgent();
    const { output: gapAnalysis, diagnostics: gapDiag } = await gapAgent.run({
      jdStrategy: strategy,
      sourceSelection: selection,
    });
    this.recordAgentDiagnostics('gapAnalyzer', gapDiag);

    // Save state and pause for user review
    await this.saveAnalysisResults(strategy, selection, gapAnalysis);
    await this.updateState('gap-review');

    this.diagnostics.timing.totalDurationMs = Date.now() - phaseStart;
    await this.saveDiagnostics();

    return {
      sessionId: this.sessionId,
      state: 'gap-review',
      strategy,
      selection,
      gapAnalysis,
    };
  }

  /**
   * Phase 2: Generate Resume → Validate
   * Requires session to be in "approved" state
   */
  async runGenerationPhase(): Promise<GenerationPhaseResult> {
    const phaseStart = Date.now();

    // Load session state
    const session = await this.loadSession();

    if (session.state !== 'approved') {
      throw new Error(
        `Cannot generate - session state is "${session.state}", must be "approved"`
      );
    }

    if (!session.jdStrategy || !session.sourceSelection || !session.gapAnalysis) {
      throw new Error('Session is missing required analysis data');
    }

    // Load existing diagnostics to append to
    await this.loadDiagnostics();

    // Step 4: Resume Writer
    await this.updateState('generating');
    const writerAgent = new ResumeWriterAgent();
    const { output: writerOutput, diagnostics: writerDiag } = await writerAgent.run({
      strategy: session.jdStrategy,
      selection: session.sourceSelection,
      gapAnalysis: session.gapAnalysis,
      userAdjustments: session.userAdjustments || null,
    });
    this.recordAgentDiagnostics('resumeWriter', writerDiag);

    // Step 5: Validator
    await this.updateState('validating');
    const validatorAgent = new ValidatorAgent();
    const { output: validation, diagnostics: validatorDiag } = await validatorAgent.run({
      strategy: session.jdStrategy,
      selection: session.sourceSelection,
      writerOutput,
    });
    this.recordAgentDiagnostics('validator', validatorDiag);

    // Determine final state
    const finalState: PipelineState = validation.passed ? 'complete' : 'failed';

    // Save final state
    await this.saveGenerationResults(writerOutput, validation, finalState);

    this.diagnostics.timing.totalDurationMs += Date.now() - phaseStart;
    await this.saveDiagnostics();

    return {
      sessionId: this.sessionId,
      state: finalState,
      writerOutput,
      validation,
    };
  }

  /**
   * Get the session ID for this pipeline instance
   */
  getSessionId(): string {
    return this.sessionId;
  }

  // ============================================
  // Private Helper Methods
  // ============================================

  private async initializeSession(jobDescription: string): Promise<void> {
    const now = new Date().toISOString();

    const initialSession: PipelineSession = {
      id: this.sessionId,
      state: 'analyzing',
      jobDescription,
      createdAt: now,
      updatedAt: now,
    };

    await db.insert(sessions).values({
      id: this.sessionId,
      jobDescription,
      v2Session: initialSession,
      v2Status: 'analyzing',
      v2Diagnostics: this.diagnostics,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  private async loadSession(): Promise<PipelineSession> {
    const [row] = await db
      .select()
      .from(sessions)
      .where(eq(sessions.id, this.sessionId));

    if (!row) {
      throw new Error(`Session ${this.sessionId} not found`);
    }

    const v2Session = row.v2Session as PipelineSession | null;

    if (!v2Session) {
      throw new Error(`Session ${this.sessionId} has no V2 data`);
    }

    return v2Session;
  }

  private async loadDiagnostics(): Promise<void> {
    const [row] = await db
      .select({ v2Diagnostics: sessions.v2Diagnostics })
      .from(sessions)
      .where(eq(sessions.id, this.sessionId));

    if (row?.v2Diagnostics) {
      this.diagnostics = row.v2Diagnostics as PipelineDiagnostics;
    }
  }

  private async updateState(state: PipelineState): Promise<void> {
    const session = await this.loadSession();

    await db
      .update(sessions)
      .set({
        v2Session: {
          ...session,
          state,
          updatedAt: new Date().toISOString(),
        },
        v2Status: state,
        updatedAt: new Date(),
      })
      .where(eq(sessions.id, this.sessionId));
  }

  private async saveAnalysisResults(
    strategy: JDStrategy,
    selection: ContentSelectionResult,
    gapAnalysis: GapAnalysis
  ): Promise<void> {
    const session = await this.loadSession();

    await db
      .update(sessions)
      .set({
        v2Session: {
          ...session,
          jdStrategy: strategy,
          sourceSelection: selection,
          gapAnalysis,
          updatedAt: new Date().toISOString(),
        },
        updatedAt: new Date(),
      })
      .where(eq(sessions.id, this.sessionId));
  }

  private async saveGenerationResults(
    writerOutput: WriterOutput,
    validation: ValidationResult,
    finalState: PipelineState
  ): Promise<void> {
    const session = await this.loadSession();

    await db
      .update(sessions)
      .set({
        v2Session: {
          ...session,
          state: finalState,
          writerOutput,
          validationResult: validation,
          updatedAt: new Date().toISOString(),
        },
        v2Status: finalState,
        updatedAt: new Date(),
      })
      .where(eq(sessions.id, this.sessionId));
  }

  private recordAgentDiagnostics(
    agentName: 'jdStrategist' | 'gapAnalyzer' | 'resumeWriter' | 'validator',
    diagnostics: AgentDiagnostics
  ): void {
    // Store agent diagnostics
    this.diagnostics.agents[agentName] = diagnostics;

    // Update timing
    this.diagnostics.timing.agentTimings.push({
      agent: agentName === 'jdStrategist'
        ? 'jd_strategist'
        : agentName === 'gapAnalyzer'
        ? 'gap_analyzer'
        : agentName === 'resumeWriter'
        ? 'resume_writer'
        : 'validator',
      durationMs: diagnostics.durationMs,
      tokens: {
        prompt: diagnostics.inputTokens,
        completion: diagnostics.outputTokens,
      },
    });

    // Update costs
    this.diagnostics.costs.totalUSD += diagnostics.cost;
    this.diagnostics.costs.byAgent.push({
      agent: agentName,
      costUSD: diagnostics.cost,
    });
  }

  private async saveDiagnostics(): Promise<void> {
    await db
      .update(sessions)
      .set({
        v2Diagnostics: this.diagnostics,
        updatedAt: new Date(),
      })
      .where(eq(sessions.id, this.sessionId));
  }
}
