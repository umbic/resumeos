// ============================================
// ResumeOS V2: Validation Endpoint
// ============================================
//
// Runs the Validator agent to check the written resume.
// Requires session to be in "validating" state.

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sessions } from '@/drizzle/schema';
import { eq } from 'drizzle-orm';
import { ValidatorAgent } from '@/lib/agents/validator';
import type { PipelineSession, PipelineDiagnostics, ValidationResult } from '@/types/v2';

export const maxDuration = 60;

interface ValidateRequest {
  sessionId: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: ValidateRequest = await request.json();
    const { sessionId } = body;

    if (!sessionId) {
      return NextResponse.json(
        { error: 'sessionId is required' },
        { status: 400 }
      );
    }

    // Fetch session
    const [session] = await db
      .select()
      .from(sessions)
      .where(eq(sessions.id, sessionId));

    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    const v2Session = session.v2Session as PipelineSession | null;

    if (!v2Session) {
      return NextResponse.json(
        { error: 'No V2 session data found' },
        { status: 400 }
      );
    }

    // Enforce state machine: must be "validating" to validate
    if (v2Session.state !== 'validating') {
      return NextResponse.json(
        {
          error: `Cannot validate - session state is "${v2Session.state}", must be "validating"`,
          currentState: v2Session.state,
        },
        { status: 400 }
      );
    }

    // Verify we have all required data
    if (!v2Session.jdStrategy || !v2Session.sourceSelection || !v2Session.writerOutput) {
      return NextResponse.json(
        {
          error: 'Session is missing required data for validation',
          hasJdStrategy: !!v2Session.jdStrategy,
          hasSourceSelection: !!v2Session.sourceSelection,
          hasWriterOutput: !!v2Session.writerOutput,
        },
        { status: 400 }
      );
    }

    // Run the Validator agent
    const agent = new ValidatorAgent();
    const { output, diagnostics } = await agent.run({
      strategy: v2Session.jdStrategy,
      selection: v2Session.sourceSelection,
      writerOutput: v2Session.writerOutput,
    });

    // Determine final state based on validation result
    const finalState = output.passed ? 'complete' : 'failed';

    // Update session with validation result
    const completedSession: PipelineSession = {
      ...v2Session,
      state: finalState,
      validationResult: output,
      updatedAt: new Date().toISOString(),
      ...(finalState === 'failed' && {
        error: {
          stage: 'validating',
          message: `Validation failed: ${output.suggestedFixes.length} issues found`,
          timestamp: new Date().toISOString(),
        },
      }),
    };

    // Update diagnostics
    const existingDiagnostics = session.v2Diagnostics as PipelineDiagnostics | null;
    const updatedDiagnostics: PipelineDiagnostics = {
      sessionId,
      pipelineVersion: 'v2',
      timing: existingDiagnostics?.timing || {
        totalDurationMs: 0,
        agentTimings: [],
        contentSelectionMs: 0,
      },
      costs: existingDiagnostics?.costs || {
        totalUSD: 0,
        byAgent: [],
      },
      agents: {
        ...existingDiagnostics?.agents,
        validator: diagnostics,
      },
      contentSelection: existingDiagnostics?.contentSelection,
      userIntervention: existingDiagnostics?.userIntervention,
    };

    // Update agent timing
    updatedDiagnostics.timing.agentTimings.push({
      agent: 'validator',
      durationMs: diagnostics.durationMs,
      tokens: {
        prompt: diagnostics.inputTokens,
        completion: diagnostics.outputTokens,
      },
    });

    // Update costs
    updatedDiagnostics.costs.byAgent.push({
      agent: 'validator',
      costUSD: diagnostics.cost,
    });
    updatedDiagnostics.costs.totalUSD = updatedDiagnostics.costs.byAgent.reduce(
      (sum, a) => sum + a.costUSD,
      0
    );

    // Calculate total duration if all agents have run
    if (
      updatedDiagnostics.agents.jdStrategist &&
      updatedDiagnostics.agents.gapAnalyzer &&
      updatedDiagnostics.agents.resumeWriter &&
      updatedDiagnostics.agents.validator
    ) {
      updatedDiagnostics.timing.totalDurationMs =
        updatedDiagnostics.timing.agentTimings.reduce((sum, t) => sum + t.durationMs, 0) +
        (updatedDiagnostics.timing.contentSelectionMs || 0);
    }

    await db
      .update(sessions)
      .set({
        v2Session: completedSession,
        v2Status: finalState,
        v2Diagnostics: updatedDiagnostics,
        updatedAt: new Date(),
      })
      .where(eq(sessions.id, sessionId));

    // Build response summary
    const summary = buildValidationSummary(output);

    return NextResponse.json({
      success: true,
      sessionId,
      state: finalState,
      validation: output,
      summary,
      diagnostics: {
        inputTokens: diagnostics.inputTokens,
        outputTokens: diagnostics.outputTokens,
        cost: diagnostics.cost,
        durationMs: diagnostics.durationMs,
      },
    });
  } catch (error) {
    console.error('Validator error:', error);

    // Try to update session status to failed
    try {
      const body = await request.clone().json();
      if (body.sessionId) {
        const [session] = await db
          .select()
          .from(sessions)
          .where(eq(sessions.id, body.sessionId));

        if (session && session.v2Session) {
          const v2Session = session.v2Session as PipelineSession;
          const failedSession: PipelineSession = {
            ...v2Session,
            state: 'failed',
            error: {
              stage: 'validating',
              message: error instanceof Error ? error.message : 'Validation failed',
              timestamp: new Date().toISOString(),
            },
            updatedAt: new Date().toISOString(),
          };

          await db
            .update(sessions)
            .set({
              v2Session: failedSession,
              v2Status: 'failed',
              updatedAt: new Date(),
            })
            .where(eq(sessions.id, body.sessionId));
        }
      }
    } catch {
      // Ignore errors when updating failure status
    }

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Validation failed',
      },
      { status: 500 }
    );
  }
}

/**
 * Build a human-readable summary of validation results
 */
function buildValidationSummary(validation: ValidationResult): {
  verdict: string;
  scores: { honesty: number; coverage: number; quality: number; overall: number };
  blockerCount: number;
  warningCount: number;
  suggestionCount: number;
  topIssues: string[];
} {
  // Count issues by severity
  let blockerCount = 0;
  let warningCount = 0;
  let suggestionCount = 0;
  const topIssues: string[] = [];

  // Count honesty issues
  validation.honesty.issues.forEach((issue) => {
    if (issue.severity === 'blocker') {
      blockerCount++;
      topIssues.push(`[HONESTY] ${issue.location}: ${issue.claim}`);
    } else {
      warningCount++;
    }
  });

  // Count quality issues
  validation.quality.issues.forEach((issue) => {
    if (issue.severity === 'blocker') {
      blockerCount++;
      topIssues.push(`[QUALITY] ${issue.location}: ${issue.detail}`);
    } else if (issue.severity === 'warning') {
      warningCount++;
    } else {
      suggestionCount++;
    }
  });

  // Determine verdict message
  let verdict: string;
  if (validation.passed && blockerCount === 0 && warningCount === 0) {
    verdict = 'PASSED - Resume is ready for export';
  } else if (validation.passed) {
    verdict = `PASSED WITH WARNINGS - ${warningCount} warning(s) to consider`;
  } else {
    verdict = `FAILED - ${blockerCount} blocker(s) must be fixed`;
  }

  return {
    verdict,
    scores: {
      honesty: validation.honesty.score,
      coverage: validation.coverage.score,
      quality: validation.quality.score,
      overall: validation.overallScore,
    },
    blockerCount,
    warningCount,
    suggestionCount,
    topIssues: topIssues.slice(0, 5), // Top 5 issues
  };
}
