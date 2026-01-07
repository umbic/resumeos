// src/lib/v3/orchestrator.ts
// V3 Pipeline Orchestrator - runs 6 sequential chats with validation and retry

import type {
  V3Input,
  V3Result,
  V3Diagnostics,
  StepDiagnostic,
  ContentSources,
  Profile,
  JDAnalyzerOutput,
  SummaryChatOutput,
  CHChatOutput,
  P1ChatOutput,
  P2ChatOutput,
  P3P6ChatOutput,
  AccumulatedState,
} from './types';

import { callClaude, calculateCost, parseJsonResponse, V3_MODEL } from './claude-client';

import {
  buildJDAnalyzerPrompt,
  buildSummaryChatPrompt,
  buildCHChatPrompt,
  buildP1ChatPrompt,
  buildP2ChatPrompt,
  buildP3P6ChatPrompt,
} from './prompts';

import {
  validateJDOutput,
  validateSummaryOutput,
  validateCHOutput,
  validateP1Output,
  validateP2Output,
  validateP3P6Output,
} from './validators';

import { getPosition, getPositions3to6 } from './content-loader';

// Configuration
const MAX_RETRIES = 3;
const DEFAULT_MAX_TOKENS = 4096;

// Step names for diagnostics
type StepName = 'jd-analyzer' | 'summary' | 'ch' | 'p1' | 'p2' | 'p3p6';

export interface OrchestratorConfig {
  profile: Profile;
  contentSources: ContentSources;
  maxRetries?: number;
  model?: string;
}

interface StepResult<T> {
  success: boolean;
  output?: T;
  diagnostic: StepDiagnostic;
  error?: string;
}

/**
 * Main orchestrator - runs the V3 pipeline
 */
export async function runV3Pipeline(
  input: V3Input,
  config: OrchestratorConfig
): Promise<V3Result> {
  const sessionId = generateSessionId();
  const startedAt = new Date().toISOString();
  const startTime = Date.now();

  const diagnostics: V3Diagnostics = {
    sessionId,
    startedAt,
    completedAt: '',
    totalDurationMs: 0,
    totalCost: 0,
    steps: [],
    errors: [],
    warnings: [],
  };

  const maxRetries = config.maxRetries ?? MAX_RETRIES;

  try {
    // Step 1: JD Analyzer
    const jdResult = await runStep<JDAnalyzerOutput>(
      'jd-analyzer',
      () => buildJDAnalyzerPrompt(input.jobDescription),
      (response) => parseJsonResponse<JDAnalyzerOutput>(response),
      validateJDOutput,
      maxRetries,
      config.model
    );
    diagnostics.steps.push(jdResult.diagnostic);

    if (!jdResult.success || !jdResult.output) {
      return createFailedResult(sessionId, diagnostics, 'JD analysis failed', jdResult.error);
    }
    const jdAnalysis = jdResult.output;

    // Step 2: Summary Chat
    const summaryResult = await runStep<SummaryChatOutput>(
      'summary',
      (prevIssues) => buildSummaryChatPrompt(jdAnalysis, config.contentSources.summaries, prevIssues),
      (response) => parseJsonResponse<SummaryChatOutput>(response),
      (output) => validateSummaryOutput(output),
      maxRetries,
      config.model
    );
    diagnostics.steps.push(summaryResult.diagnostic);

    if (!summaryResult.success || !summaryResult.output) {
      return createFailedResult(sessionId, diagnostics, 'Summary generation failed', summaryResult.error);
    }
    const summaryOutput = summaryResult.output;

    // Step 3: CH Chat
    // Build state for CH validation (CH doesn't use upstream state for validation)
    const stateForCH = createEmptyState();

    const chResult = await runStep<CHChatOutput>(
      'ch',
      (prevIssues) => buildCHChatPrompt(
        jdAnalysis,
        config.contentSources.careerHighlights,
        summaryOutput,
        prevIssues
      ),
      (response) => parseJsonResponse<CHChatOutput>(response),
      (output) => validateCHOutput(output, stateForCH),
      maxRetries,
      config.model
    );
    diagnostics.steps.push(chResult.diagnostic);

    if (!chResult.success || !chResult.output) {
      return createFailedResult(sessionId, diagnostics, 'Career highlights generation failed', chResult.error);
    }
    const chOutput = chResult.output;

    // Step 4: P1 Chat
    const position1 = getPosition(config.profile, 1);
    if (!position1) {
      return createFailedResult(sessionId, diagnostics, 'Position 1 not found in profile');
    }

    // Build state for P1 validation (deduplicate to avoid double-counting)
    const stateForP1: AccumulatedState = {
      ...createEmptyState(),
      allUsedBaseIds: [...new Set(chOutput.stateForDownstream.usedBaseIds)],
      allUsedVerbs: [...new Set([
        ...summaryOutput.stateForDownstream.usedVerbs,
        ...chOutput.stateForDownstream.usedVerbs,
      ])],
      allUsedMetrics: [...new Set([
        ...summaryOutput.stateForDownstream.usedMetrics,
        ...chOutput.stateForDownstream.usedMetrics,
      ])],
    };

    const p1Result = await runStep<P1ChatOutput>(
      'p1',
      (prevIssues) => buildP1ChatPrompt(
        jdAnalysis,
        config.contentSources.p1Sources,
        position1,
        summaryOutput,
        chOutput,
        prevIssues
      ),
      (response) => parseJsonResponse<P1ChatOutput>(response),
      (output) => validateP1Output(output, stateForP1),
      maxRetries,
      config.model
    );
    diagnostics.steps.push(p1Result.diagnostic);

    if (!p1Result.success || !p1Result.output) {
      return createFailedResult(sessionId, diagnostics, 'Position 1 generation failed', p1Result.error);
    }
    const p1Output = p1Result.output;

    // Step 5: P2 Chat
    const position2 = getPosition(config.profile, 2);
    if (!position2) {
      return createFailedResult(sessionId, diagnostics, 'Position 2 not found in profile');
    }

    // Build state for P2 validation (deduplicate)
    const stateForP2: AccumulatedState = {
      ...createEmptyState(),
      allUsedBaseIds: [...new Set([
        ...chOutput.stateForDownstream.usedBaseIds,
        ...p1Output.stateForDownstream.usedBaseIds,
      ])],
      allUsedVerbs: [...new Set([
        ...summaryOutput.stateForDownstream.usedVerbs,
        ...chOutput.stateForDownstream.usedVerbs,
        ...p1Output.stateForDownstream.usedVerbs,
      ])],
      allUsedMetrics: [...new Set([
        ...summaryOutput.stateForDownstream.usedMetrics,
        ...chOutput.stateForDownstream.usedMetrics,
        ...p1Output.stateForDownstream.usedMetrics,
      ])],
    };

    const p2Result = await runStep<P2ChatOutput>(
      'p2',
      (prevIssues) => buildP2ChatPrompt(
        jdAnalysis,
        config.contentSources.p2Sources,
        position2,
        summaryOutput,
        chOutput,
        p1Output,
        prevIssues
      ),
      (response) => parseJsonResponse<P2ChatOutput>(response),
      (output) => validateP2Output(output, stateForP2),
      maxRetries,
      config.model
    );
    diagnostics.steps.push(p2Result.diagnostic);

    if (!p2Result.success || !p2Result.output) {
      return createFailedResult(sessionId, diagnostics, 'Position 2 generation failed', p2Result.error);
    }
    const p2Output = p2Result.output;

    // Step 6: P3-P6 Chat
    const positions3to6 = getPositions3to6(config.profile);
    if (positions3to6.length < 4) {
      diagnostics.warnings.push(`Only ${positions3to6.length} positions available for P3-P6 (expected 4)`);
    }

    // Collect all verbs used so far (deduplicated)
    const allUsedVerbs = [...new Set([
      ...summaryOutput.stateForDownstream.usedVerbs,
      ...chOutput.stateForDownstream.usedVerbs,
      ...p1Output.stateForDownstream.usedVerbs,
      ...p2Output.stateForDownstream.usedVerbs,
    ])];

    // Build state for P3-P6 validation
    const stateForP3P6: AccumulatedState = {
      ...createEmptyState(),
      allUsedVerbs,
    };

    const p3p6Result = await runStep<P3P6ChatOutput>(
      'p3p6',
      (prevIssues) => buildP3P6ChatPrompt(
        jdAnalysis,
        config.contentSources.p3p6Overviews,
        positions3to6,
        allUsedVerbs,
        prevIssues
      ),
      (response) => parseJsonResponse<P3P6ChatOutput>(response),
      (output) => validateP3P6Output(output, stateForP3P6),
      maxRetries,
      config.model
    );
    diagnostics.steps.push(p3p6Result.diagnostic);

    if (!p3p6Result.success || !p3p6Result.output) {
      return createFailedResult(sessionId, diagnostics, 'Positions 3-6 generation failed', p3p6Result.error);
    }
    const p3p6Output = p3p6Result.output;

    // Calculate totals
    diagnostics.completedAt = new Date().toISOString();
    diagnostics.totalDurationMs = Date.now() - startTime;
    diagnostics.totalCost = diagnostics.steps.reduce((sum, s) => sum + s.cost, 0);

    // Build final coverage from P2 output
    const finalCoverage = {
      jdSections: p2Output.coverageAnalysis.finalCoverage,
      gaps: p2Output.coverageAnalysis.remainingGaps,
      unusedHighPhrases: p2Output.coverageAnalysis.unusedHighPhrases,
    };

    return {
      success: true,
      sessionId,
      jdAnalysis,
      summary: summaryOutput,
      careerHighlights: chOutput,
      position1: p1Output,
      position2: p2Output,
      positions3to6: p3p6Output,
      finalCoverage,
      diagnostics,
    };
  } catch (error) {
    diagnostics.completedAt = new Date().toISOString();
    diagnostics.totalDurationMs = Date.now() - startTime;
    diagnostics.errors.push({
      step: 'orchestrator',
      error: error instanceof Error ? error.message : String(error),
      fatal: true,
    });

    return createFailedResult(
      sessionId,
      diagnostics,
      'Pipeline failed with unexpected error',
      error instanceof Error ? error.message : String(error)
    );
  }
}

/**
 * Run a single step with validation and retry logic
 */
async function runStep<T>(
  stepName: StepName,
  buildPrompt: (previousIssues?: string[]) => string,
  parseResponse: (response: string) => T,
  validate: (output: T) => { valid: boolean; issues: string[]; canRetry: boolean },
  maxRetries: number,
  model?: string
): Promise<StepResult<T>> {
  const startTime = Date.now();
  let retryCount = 0;
  let previousIssues: string[] | undefined;
  let lastError: string | undefined;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  while (retryCount <= maxRetries) {
    try {
      const prompt = buildPrompt(previousIssues);

      const response = await callClaude({
        model: model || V3_MODEL,
        messages: [{ role: 'user', content: prompt }],
        maxTokens: DEFAULT_MAX_TOKENS,
        temperature: 0.3,
      });

      totalInputTokens += response.usage.inputTokens;
      totalOutputTokens += response.usage.outputTokens;

      // Parse response
      const output = parseResponse(response.content);

      // Validate
      const validation = validate(output);

      if (validation.valid) {
        return {
          success: true,
          output,
          diagnostic: {
            step: stepName,
            status: retryCount > 0 ? 'retry' : 'success',
            durationMs: Date.now() - startTime,
            inputTokens: totalInputTokens,
            outputTokens: totalOutputTokens,
            cost: calculateCost({ inputTokens: totalInputTokens, outputTokens: totalOutputTokens }),
            retryCount,
          },
        };
      }

      // Validation failed - prepare for retry
      previousIssues = validation.issues;
      lastError = `Validation failed: ${validation.issues.join('; ')}`;

      if (!validation.canRetry) {
        break;
      }

      retryCount++;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      retryCount++;

      if (retryCount > maxRetries) {
        break;
      }

      // For parse errors, include them in previousIssues
      previousIssues = [lastError];
    }
  }

  // All retries exhausted
  return {
    success: false,
    error: lastError,
    diagnostic: {
      step: stepName,
      status: 'failed',
      durationMs: Date.now() - startTime,
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
      cost: calculateCost({ inputTokens: totalInputTokens, outputTokens: totalOutputTokens }),
      retryCount,
      validationIssues: previousIssues,
    },
  };
}

/**
 * Create a failed result object
 */
function createFailedResult(
  sessionId: string,
  diagnostics: V3Diagnostics,
  message: string,
  error?: string
): V3Result {
  diagnostics.completedAt = new Date().toISOString();
  diagnostics.errors.push({
    step: 'orchestrator',
    error: error || message,
    fatal: true,
  });

  // Return partial result with empty outputs
  return {
    success: false,
    sessionId,
    jdAnalysis: {} as JDAnalyzerOutput,
    summary: {} as SummaryChatOutput,
    careerHighlights: {} as CHChatOutput,
    position1: {} as P1ChatOutput,
    position2: {} as P2ChatOutput,
    positions3to6: {} as P3P6ChatOutput,
    finalCoverage: {
      jdSections: [],
      gaps: [],
      unusedHighPhrases: [],
    },
    diagnostics,
  };
}

/**
 * Generate a unique session ID
 */
function generateSessionId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `v3-${timestamp}-${random}`;
}

/**
 * Create an empty AccumulatedState for validation
 */
function createEmptyState(): AccumulatedState {
  return {
    summaryVerbs: [],
    summaryMetrics: [],
    summaryPhrases: [],
    summarySectionsAddressed: [],
    chUsedBaseIds: [],
    chUsedVerbs: [],
    chUsedMetrics: [],
    chCoverage: [],
    p1UsedBaseIds: [],
    p1UsedVerbs: [],
    p1UsedMetrics: [],
    p1SectionsAddressed: [],
    p2UsedBaseIds: [],
    p2UsedVerbs: [],
    allUsedBaseIds: [],
    allUsedVerbs: [],
    allUsedMetrics: [],
  };
}

/**
 * Build accumulated state from all outputs (utility for external use)
 */
export function buildAccumulatedState(
  summaryOutput: SummaryChatOutput,
  chOutput: CHChatOutput,
  p1Output: P1ChatOutput,
  p2Output: P2ChatOutput
): AccumulatedState {
  return {
    // From Summary
    thematicAnchors: summaryOutput.thematicAnchors,
    summaryVerbs: summaryOutput.stateForDownstream.usedVerbs,
    summaryMetrics: summaryOutput.stateForDownstream.usedMetrics,
    summaryPhrases: summaryOutput.stateForDownstream.jdPhrasesUsed,
    summarySectionsAddressed: summaryOutput.stateForDownstream.jdSectionsAddressed,

    // From CH
    chUsedBaseIds: chOutput.stateForDownstream.usedBaseIds,
    chUsedVerbs: chOutput.stateForDownstream.usedVerbs,
    chUsedMetrics: chOutput.stateForDownstream.usedMetrics,
    chCoverage: chOutput.coverageAnalysis.jdSectionsCovered,

    // From P1
    p1UsedBaseIds: p1Output.stateForDownstream.usedBaseIds,
    p1UsedVerbs: p1Output.stateForDownstream.usedVerbs,
    p1UsedMetrics: p1Output.stateForDownstream.usedMetrics,
    p1SectionsAddressed: p1Output.coverageAnalysis.phrasesCovered,

    // From P2
    p2UsedBaseIds: p2Output.stateForDownstream.usedBaseIds,
    p2UsedVerbs: p2Output.stateForDownstream.usedVerbs,

    // Computed aggregates
    allUsedBaseIds: [
      ...chOutput.stateForDownstream.usedBaseIds,
      ...p1Output.stateForDownstream.usedBaseIds,
      ...p2Output.stateForDownstream.usedBaseIds,
    ],
    allUsedVerbs: [
      ...summaryOutput.stateForDownstream.usedVerbs,
      ...chOutput.stateForDownstream.usedVerbs,
      ...p1Output.stateForDownstream.usedVerbs,
      ...p2Output.stateForDownstream.usedVerbs,
    ],
    allUsedMetrics: [
      ...summaryOutput.stateForDownstream.usedMetrics,
      ...chOutput.stateForDownstream.usedMetrics,
      ...p1Output.stateForDownstream.usedMetrics,
    ],
  };
}
