// ============================================================
// ResumeOS V2.1: Two-Phase Writer Pipeline Orchestrator
// ============================================================
//
// Pipeline Flow:
// 1. ANALYSIS PHASE (POST /api/v2.1/pipeline/start)
//    - JD Strategist (Agent 1)
//    - Content Selection (Code)
//    - Content Allocation (Code) ← NEW in V2.1
//    - Gap Analyzer (Agent 2)
//    → Status: "gap-review" ← PAUSES HERE
//
// 2. [User reviews, swaps, approves via UI]
//
// 3. GENERATION PHASE (POST /api/v2.1/pipeline/generate)
//    - Narrative Writer (Phase 1) ← NEW in V2.1
//    - Detail Writer (Phase 2) ← NEW in V2.1
//    - Validator
//    - Assembler
//    → Status: "complete" or "failed"

import { db } from '@/lib/db';
import { sessions } from '@/drizzle/schema';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

import { JDStrategistAgent } from '@/lib/agents/jd-strategist';
import { GapAnalyzerAgent } from '@/lib/agents/gap-analyzer';
import { NarrativeWriterAgent } from '@/lib/agents/narrative-writer';
import { DetailWriterAgent } from '@/lib/agents/detail-writer';
import { ValidatorAgentV21 } from '@/lib/agents/validator-v21';

import { selectContentV2 } from '@/lib/content-selector-v2';
import { allocateContent, getAllocationSummary } from './content-allocator';
import { assembleResume, formatResumeAsMarkdown } from './assembler';
import { getProfile } from '@/lib/data/umberto-profile';
import { transformSelectionToAllocatorInput } from './selection-transformer';

import type {
  PipelineStateV21,
  PipelineSessionV21,
  ContentAllocation,
  NarrativeWriterOutput,
  DetailWriterOutput,
  ValidationResultV21,
  AssembledResume,
} from '@/types/v2.1';
import type {
  JDStrategy,
  GapAnalysis,
  ContentSelectionResult,
  PipelineSession as PipelineSessionFromV2,
  PipelineDiagnostics as PipelineDiagnosticsFromV2,
  PipelineState as PipelineStateFromV2,
} from '@/types/v2';

// ============================================================
// Types
// ============================================================

export interface PipelineDiagnostics {
  startedAt: string;
  completedAt?: string;
  totalDurationMs?: number;
  totalCost: number;
  agents: {
    jdStrategist?: AgentDiagnostic;
    gapAnalyzer?: AgentDiagnostic;
    narrativeWriter?: AgentDiagnostic;
    detailWriter?: AgentDiagnostic;
    validator?: AgentDiagnostic;
  };
  contentSelection?: {
    durationMs: number;
  };
  allocation?: {
    summary: ReturnType<typeof getAllocationSummary>;
    log: ContentAllocation['allocationLog'];
  };
}

interface AgentDiagnostic {
  inputTokens: number;
  outputTokens: number;
  cost: number;
  durationMs: number;
}

interface AnalysisPhaseResult {
  sessionId: string;
  status: PipelineStateV21;
  jdStrategy: JDStrategy;
  allocation: ContentAllocation;
  gapAnalysis: GapAnalysis;
}

interface GenerationPhaseResult {
  sessionId: string;
  status: PipelineStateV21;
  resume: AssembledResume;
  resumeMarkdown: string;
  validation: ValidationResultV21;
  diagnostics: PipelineDiagnostics;
}

// ============================================================
// Pipeline Orchestrator
// ============================================================

export class V21Pipeline {
  private sessionId: string;
  private diagnostics: PipelineDiagnostics;

  constructor(sessionId?: string) {
    this.sessionId = sessionId || uuidv4();
    this.diagnostics = {
      startedAt: new Date().toISOString(),
      totalCost: 0,
      agents: {},
    };
  }

  /**
   * PHASE 1: Analysis
   * JD Strategist -> Content Selection -> Allocation -> Gap Analyzer
   * Returns at 'gap-review' for user intervention
   */
  async runAnalysisPhase(
    jobDescription: string,
    profileId: string = 'default'
  ): Promise<AnalysisPhaseResult> {
    console.log(`[V2.1 Pipeline] Starting analysis phase for session ${this.sessionId}`);

    // Initialize session
    await this.initializeSession(jobDescription, profileId);

    try {
      // 1. JD Strategist
      await this.updateStatus('analyzing');
      console.log('[V2.1 Pipeline] Running JD Strategist...');
      const jdAgent = new JDStrategistAgent();
      const jdResult = await jdAgent.run({ jobDescription });
      this.recordAgentDiagnostics('jdStrategist', jdResult.diagnostics);

      // 2. Content Selection
      await this.updateStatus('selecting');
      console.log('[V2.1 Pipeline] Running Content Selection...');
      const selectionStart = Date.now();
      const contentSelection = await selectContentV2(jdResult.output);
      this.diagnostics.contentSelection = { durationMs: Date.now() - selectionStart };

      // 3. Content Allocation (NEW in V2.1)
      await this.updateStatus('allocating');
      console.log('[V2.1 Pipeline] Running Content Allocation...');
      const allocatorInput = transformSelectionToAllocatorInput(contentSelection);
      const allocation = allocateContent(allocatorInput);
      this.diagnostics.allocation = {
        summary: getAllocationSummary(allocation),
        log: allocation.allocationLog,
      };

      // 4. Gap Analyzer
      console.log('[V2.1 Pipeline] Running Gap Analyzer...');
      const gapAgent = new GapAnalyzerAgent();
      const gapResult = await gapAgent.run({
        jdStrategy: jdResult.output,
        sourceSelection: contentSelection,
      });
      this.recordAgentDiagnostics('gapAnalyzer', gapResult.diagnostics);

      // Save analysis results
      await this.saveAnalysisResults({
        jdStrategy: jdResult.output,
        contentSelection,
        allocation,
        gapAnalysis: gapResult.output,
      });

      // Pause for user review
      await this.updateStatus('gap-review');

      return {
        sessionId: this.sessionId,
        status: 'gap-review',
        jdStrategy: jdResult.output,
        allocation,
        gapAnalysis: gapResult.output,
      };
    } catch (error) {
      await this.updateStatus('failed');
      throw error;
    }
  }

  /**
   * PHASE 2: Generation
   * Narrative Writer -> Detail Writer -> Validator -> Assembler
   * Requires 'approved' status
   */
  async runGenerationPhase(): Promise<GenerationPhaseResult> {
    console.log(`[V2.1 Pipeline] Starting generation phase for session ${this.sessionId}`);

    // Load session
    const session = await this.loadSession();

    // Verify status
    if (session.status !== 'approved') {
      throw new Error(
        `Cannot generate: session status is '${session.status}', expected 'approved'`
      );
    }

    // Get profile
    const profile = getProfile(session.profileId || 'default');

    try {
      // 1. Narrative Writer (Phase 1)
      await this.updateStatus('writing-narrative');
      console.log('[V2.1 Pipeline] Running Narrative Writer...');
      const narrativeAgent = new NarrativeWriterAgent();
      const narrativeResult = await narrativeAgent.run({
        strategy: session.jdStrategy!,
        allocation: session.allocation!,
      });
      this.recordAgentDiagnostics('narrativeWriter', narrativeResult.diagnostics);

      // 2. Detail Writer (Phase 2)
      await this.updateStatus('writing-detail');
      console.log('[V2.1 Pipeline] Running Detail Writer...');
      const detailAgent = new DetailWriterAgent();
      const detailResult = await detailAgent.run({
        strategy: session.jdStrategy!,
        allocation: session.allocation!,
        phase1Output: narrativeResult.output,
      });
      this.recordAgentDiagnostics('detailWriter', detailResult.diagnostics);

      // 3. Validator
      await this.updateStatus('validating');
      console.log('[V2.1 Pipeline] Running Validator...');
      const validator = new ValidatorAgentV21();
      const validationResult = await validator.run({
        strategy: session.jdStrategy!,
        allocation: session.allocation!,
        narrativeOutput: narrativeResult.output,
        detailOutput: detailResult.output,
      });
      this.recordAgentDiagnostics('validator', {
        inputTokens: validationResult.diagnostics.inputTokens,
        outputTokens: validationResult.diagnostics.outputTokens,
        cost: validationResult.diagnostics.cost,
        durationMs: validationResult.diagnostics.durationMs,
      });

      // 4. Assemble Resume
      console.log('[V2.1 Pipeline] Assembling resume...');
      const assembledResume = assembleResume({
        profile,
        narrativeOutput: narrativeResult.output,
        detailOutput: detailResult.output,
        targetTitle: session.targetTitle,
      });

      const resumeMarkdown = formatResumeAsMarkdown(assembledResume);

      // Determine final status
      const finalStatus: PipelineStateV21 =
        validationResult.validation.overallVerdict === 'fail' ? 'failed' : 'complete';

      // Save generation results
      await this.saveGenerationResults({
        narrativeOutput: narrativeResult.output,
        detailOutput: detailResult.output,
        validation: validationResult.validation,
        assembledResume,
        status: finalStatus,
      });

      // Finalize diagnostics
      this.diagnostics.completedAt = new Date().toISOString();
      this.diagnostics.totalDurationMs =
        new Date(this.diagnostics.completedAt).getTime() -
        new Date(this.diagnostics.startedAt).getTime();

      return {
        sessionId: this.sessionId,
        status: finalStatus,
        resume: assembledResume,
        resumeMarkdown,
        validation: validationResult.validation,
        diagnostics: this.diagnostics,
      };
    } catch (error) {
      await this.updateStatus('failed');
      throw error;
    }
  }

  /**
   * Get the session ID for this pipeline instance
   */
  getSessionId(): string {
    return this.sessionId;
  }

  // ============================================================
  // Private Methods
  // ============================================================

  private async initializeSession(jobDescription: string, profileId: string): Promise<void> {
    const now = new Date().toISOString();

    const session: Partial<PipelineSessionV21> = {
      id: this.sessionId,
      status: 'analyzing',
      profileId,
      jobDescription,
      createdAt: now,
      jdStrategy: null,
      contentSelection: null,
      gapAnalysis: null,
      contentAllocation: null,
      userAdjustments: null,
      narrativeOutput: null,
      detailOutput: null,
      assembledResume: null,
      validation: null,
    };

    // Cast session object to satisfy schema type requirements
    // V2.1 sessions have a different structure than V2 but share the same DB column
    await db.insert(sessions).values({
      id: this.sessionId,
      jobDescription,
      v2Session: session as unknown as PipelineSessionFromV2,
      v2Diagnostics: this.diagnostics as unknown as PipelineDiagnosticsFromV2,
      v2Status: 'analyzing' as PipelineStateFromV2,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  private async loadSession(): Promise<{
    status: PipelineStateV21;
    profileId?: string;
    targetTitle?: string;
    jdStrategy?: JDStrategy;
    allocation?: ContentAllocation;
    gapAnalysis?: GapAnalysis;
    userAdjustments?: { additionalContext?: string; approvedAt?: string };
    narrativeOutput?: NarrativeWriterOutput;
    detailOutput?: DetailWriterOutput;
    validation?: ValidationResultV21;
    assembledResume?: AssembledResume;
  }> {
    const [row] = await db.select().from(sessions).where(eq(sessions.id, this.sessionId));

    if (!row) {
      throw new Error(`Session not found: ${this.sessionId}`);
    }

    const v2Session = row.v2Session as unknown as Record<string, unknown> | null;
    if (!v2Session) {
      throw new Error(`Session ${this.sessionId} has no V2 data`);
    }

    return {
      status: (row.v2Status as PipelineStateV21) || 'failed',
      profileId: v2Session.profileId as string | undefined,
      targetTitle: v2Session.targetTitle as string | undefined,
      jdStrategy: v2Session.jdStrategy as JDStrategy | undefined,
      allocation: (v2Session.allocation || v2Session.contentAllocation) as ContentAllocation | undefined,
      gapAnalysis: v2Session.gapAnalysis as GapAnalysis | undefined,
      userAdjustments: v2Session.userAdjustments as { additionalContext?: string; approvedAt?: string } | undefined,
      narrativeOutput: v2Session.narrativeOutput as NarrativeWriterOutput | undefined,
      detailOutput: v2Session.detailOutput as DetailWriterOutput | undefined,
      validation: v2Session.validation as ValidationResultV21 | undefined,
      assembledResume: v2Session.assembledResume as AssembledResume | undefined,
    };
  }

  private async updateStatus(status: PipelineStateV21): Promise<void> {
    const [row] = await db.select().from(sessions).where(eq(sessions.id, this.sessionId));

    if (!row) {
      throw new Error(`Session not found: ${this.sessionId}`);
    }

    const v2Session = (row.v2Session as unknown as Record<string, unknown>) || {};

    await db
      .update(sessions)
      .set({
        v2Session: {
          ...v2Session,
          status,
          updatedAt: new Date().toISOString(),
        } as unknown as PipelineSessionFromV2,
        v2Status: status as PipelineStateFromV2,
        updatedAt: new Date(),
      })
      .where(eq(sessions.id, this.sessionId));
  }

  private async saveAnalysisResults(results: {
    jdStrategy: JDStrategy;
    contentSelection: ContentSelectionResult;
    allocation: ContentAllocation;
    gapAnalysis: GapAnalysis;
  }): Promise<void> {
    const [row] = await db.select().from(sessions).where(eq(sessions.id, this.sessionId));

    if (!row) {
      throw new Error(`Session not found: ${this.sessionId}`);
    }

    const v2Session = (row.v2Session as unknown as Record<string, unknown>) || {};

    const updatedSession = {
      ...v2Session,
      jdStrategy: results.jdStrategy,
      contentSelection: results.contentSelection,
      allocation: results.allocation,
      gapAnalysis: results.gapAnalysis,
      updatedAt: new Date().toISOString(),
    };

    await db
      .update(sessions)
      .set({
        v2Session: updatedSession as unknown as PipelineSessionFromV2,
        v2Diagnostics: this.diagnostics as unknown as PipelineDiagnosticsFromV2,
        updatedAt: new Date(),
      })
      .where(eq(sessions.id, this.sessionId));
  }

  private async saveGenerationResults(results: {
    narrativeOutput: NarrativeWriterOutput;
    detailOutput: DetailWriterOutput;
    validation: ValidationResultV21;
    assembledResume: AssembledResume;
    status: PipelineStateV21;
  }): Promise<void> {
    const [row] = await db.select().from(sessions).where(eq(sessions.id, this.sessionId));

    if (!row) {
      throw new Error(`Session not found: ${this.sessionId}`);
    }

    const v2Session = (row.v2Session as unknown as Record<string, unknown>) || {};

    const updatedSession = {
      ...v2Session,
      narrativeOutput: results.narrativeOutput,
      detailOutput: results.detailOutput,
      validation: results.validation,
      assembledResume: results.assembledResume,
      status: results.status,
      updatedAt: new Date().toISOString(),
    };

    await db
      .update(sessions)
      .set({
        v2Session: updatedSession as unknown as PipelineSessionFromV2,
        v2Diagnostics: this.diagnostics as unknown as PipelineDiagnosticsFromV2,
        v2Status: results.status as PipelineStateFromV2,
        updatedAt: new Date(),
      })
      .where(eq(sessions.id, this.sessionId));
  }

  private recordAgentDiagnostics(
    agent: 'jdStrategist' | 'gapAnalyzer' | 'narrativeWriter' | 'detailWriter' | 'validator',
    diagnostics: {
      inputTokens: number;
      outputTokens: number;
      cost: number;
      durationMs: number;
    }
  ): void {
    const agentDiag: AgentDiagnostic = {
      inputTokens: diagnostics.inputTokens || 0,
      outputTokens: diagnostics.outputTokens || 0,
      cost: diagnostics.cost || 0,
      durationMs: diagnostics.durationMs || 0,
    };

    this.diagnostics.agents[agent] = agentDiag;
    this.diagnostics.totalCost += agentDiag.cost;
  }
}
