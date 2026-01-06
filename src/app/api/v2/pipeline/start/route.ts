// ============================================
// ResumeOS V2: Pipeline Start Endpoint
// ============================================
//
// Initiates the analysis phase of the pipeline:
// - JD Strategist (Agent 1)
// - Content Selection (Code)
// - Gap Analyzer (Agent 2)
//
// Returns at "gap-review" state for user intervention.

import { NextRequest, NextResponse } from 'next/server';
import { V2Pipeline } from '@/lib/pipeline/v2-pipeline';
import { db } from '@/lib/db';
import { sessions } from '@/drizzle/schema';
import { eq } from 'drizzle-orm';
import type { PipelineSession } from '@/types/v2';

export const maxDuration = 120; // Analysis phase can take time

export async function POST(request: NextRequest) {
  let pipeline: V2Pipeline | null = null;

  try {
    const body = await request.json();
    const { jobDescription } = body as { jobDescription: string };

    if (!jobDescription || jobDescription.trim().length < 100) {
      return NextResponse.json(
        { error: 'Job description is required (min 100 characters)' },
        { status: 400 }
      );
    }

    pipeline = new V2Pipeline();
    const result = await pipeline.runAnalysisPhase(jobDescription.trim());

    return NextResponse.json({
      success: true,
      sessionId: result.sessionId,
      state: result.state,
      strategy: result.strategy,
      selection: result.selection,
      gapAnalysis: result.gapAnalysis,
      message: 'Analysis complete. Review gaps and approve to continue.',
      nextSteps: [
        'GET /api/v2/review-gaps?sessionId=<id> - View gaps and coverage',
        'POST /api/v2/swap-source - Swap content sources (optional)',
        'POST /api/v2/approve - Approve and proceed to generation',
      ],
    });
  } catch (error) {
    console.error('Pipeline start error:', error);

    // Mark session as failed if it was created
    if (pipeline) {
      try {
        const sessionId = pipeline.getSessionId();
        const [session] = await db
          .select()
          .from(sessions)
          .where(eq(sessions.id, sessionId));

        if (session?.v2Session) {
          const v2Session = session.v2Session as PipelineSession;
          await db
            .update(sessions)
            .set({
              v2Session: {
                ...v2Session,
                state: 'failed',
                error: {
                  stage: v2Session.state,
                  message: error instanceof Error ? error.message : 'Analysis phase failed',
                  timestamp: new Date().toISOString(),
                },
                updatedAt: new Date().toISOString(),
              },
              v2Status: 'failed',
              updatedAt: new Date(),
            })
            .where(eq(sessions.id, sessionId));
        }
      } catch (updateError) {
        console.error('Failed to mark session as failed:', updateError);
      }
    }

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Pipeline failed to start',
        sessionId: pipeline?.getSessionId(),
      },
      { status: 500 }
    );
  }
}
