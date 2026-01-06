// ============================================
// ResumeOS V2: Resume Generation Endpoint
// ============================================
//
// Runs the Resume Writer agent to generate fresh content.
// Requires session to be in "approved" state.

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sessions } from '@/drizzle/schema';
import { eq, and } from 'drizzle-orm';
import { ResumeWriterAgent } from '@/lib/agents/resume-writer';
import type { PipelineSession, PipelineDiagnostics } from '@/types/v2';

// Writer needs more time due to longer output
export const maxDuration = 120;

interface GenerateRequest {
  sessionId: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: GenerateRequest = await request.json();
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

    // Enforce state machine: must be "approved" to generate
    if (v2Session.state !== 'approved') {
      return NextResponse.json(
        {
          error: `Cannot generate - session state is "${v2Session.state}", must be "approved"`,
          currentState: v2Session.state,
        },
        { status: 400 }
      );
    }

    // Verify we have all required data
    if (!v2Session.jdStrategy || !v2Session.sourceSelection || !v2Session.gapAnalysis) {
      return NextResponse.json(
        {
          error: 'Session is missing required data',
          hasJdStrategy: !!v2Session.jdStrategy,
          hasSourceSelection: !!v2Session.sourceSelection,
          hasGapAnalysis: !!v2Session.gapAnalysis,
        },
        { status: 400 }
      );
    }

    // CRITICAL: Atomic state transition to prevent double-generate race condition
    // Only update if state is still 'approved' (optimistic locking)
    const generatingSession: PipelineSession = {
      ...v2Session,
      state: 'generating',
      updatedAt: new Date().toISOString(),
    };

    const updateResult = await db
      .update(sessions)
      .set({
        v2Session: generatingSession,
        v2Status: 'generating',
        updatedAt: new Date(),
      })
      .where(and(eq(sessions.id, sessionId), eq(sessions.v2Status, 'approved')));

    // Check if the atomic update succeeded (another request may have beaten us)
    if (updateResult.rowCount === 0) {
      // Re-fetch to see current state
      const [currentSession] = await db
        .select()
        .from(sessions)
        .where(eq(sessions.id, sessionId));

      const currentState = (currentSession?.v2Session as PipelineSession | null)?.state;
      return NextResponse.json(
        {
          error: `Generation already in progress or completed`,
          currentState: currentState || 'unknown',
        },
        { status: 409 } // Conflict
      );
    }

    // Run the Resume Writer agent
    const agent = new ResumeWriterAgent();
    const { output, diagnostics } = await agent.run({
      strategy: v2Session.jdStrategy,
      selection: v2Session.sourceSelection,
      gapAnalysis: v2Session.gapAnalysis,
      userAdjustments: v2Session.userAdjustments || null,
    });

    // Update session with writer output and transition to validating
    const validatingSession: PipelineSession = {
      ...generatingSession,
      state: 'validating',
      writerOutput: output,
      updatedAt: new Date().toISOString(),
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
        resumeWriter: diagnostics,
      },
      contentSelection: existingDiagnostics?.contentSelection,
      userIntervention: existingDiagnostics?.userIntervention,
    };

    // Update agent timing
    updatedDiagnostics.timing.agentTimings.push({
      agent: 'resume_writer',
      durationMs: diagnostics.durationMs,
      tokens: {
        prompt: diagnostics.inputTokens,
        completion: diagnostics.outputTokens,
      },
    });

    // Update costs
    updatedDiagnostics.costs.byAgent.push({
      agent: 'resume_writer',
      costUSD: diagnostics.cost,
    });
    updatedDiagnostics.costs.totalUSD = updatedDiagnostics.costs.byAgent.reduce(
      (sum, a) => sum + a.costUSD,
      0
    );

    await db
      .update(sessions)
      .set({
        v2Session: validatingSession,
        v2Status: 'validating',
        v2Diagnostics: updatedDiagnostics,
        updatedAt: new Date(),
      })
      .where(eq(sessions.id, sessionId));

    return NextResponse.json({
      success: true,
      sessionId,
      state: 'validating',
      writerOutput: output,
      diagnostics: {
        inputTokens: diagnostics.inputTokens,
        outputTokens: diagnostics.outputTokens,
        cost: diagnostics.cost,
        durationMs: diagnostics.durationMs,
      },
    });
  } catch (error) {
    console.error('Resume Writer error:', error);

    // Try to update session status to failed if we have the sessionId
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
              stage: 'generating',
              message: error instanceof Error ? error.message : 'Resume generation failed',
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
        error: error instanceof Error ? error.message : 'Resume generation failed',
      },
      { status: 500 }
    );
  }
}
