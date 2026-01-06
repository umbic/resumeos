// ============================================================
// ResumeOS V2.1: Pipeline Start Endpoint
// ============================================================
//
// Initiates the analysis phase of the V2.1 pipeline:
// - JD Strategist (Agent 1)
// - Content Selection (Code)
// - Content Allocation (Code) <- NEW in V2.1
// - Gap Analyzer (Agent 2)
//
// Returns at "gap-review" state for user intervention.

import { NextRequest, NextResponse } from 'next/server';
import { V21Pipeline } from '@/lib/pipeline/v2.1-pipeline';
import { db } from '@/lib/db';
import { sessions } from '@/drizzle/schema';
import { eq } from 'drizzle-orm';

export const maxDuration = 180; // Analysis phase can take time

export async function POST(request: NextRequest) {
  let pipeline: V21Pipeline | null = null;

  try {
    const body = await request.json();
    const { jobDescription, profileId } = body as {
      jobDescription: string;
      profileId?: string;
    };

    if (!jobDescription || jobDescription.trim().length < 100) {
      return NextResponse.json(
        { error: 'Job description is required (min 100 characters)' },
        { status: 400 }
      );
    }

    pipeline = new V21Pipeline();
    const result = await pipeline.runAnalysisPhase(
      jobDescription.trim(),
      profileId || 'default'
    );

    return NextResponse.json({
      success: true,
      sessionId: result.sessionId,
      status: result.status,
      jdStrategy: {
        company: result.jdStrategy.company,
        role: result.jdStrategy.role,
        positioning: result.jdStrategy.positioning,
      },
      allocation: {
        careerHighlights: result.allocation.careerHighlights.length,
        p1Bullets: result.allocation.position1Bullets.length,
        p2Bullets: result.allocation.position2Bullets.length,
      },
      gapAnalysis: {
        overallCoverage: result.gapAnalysis.overallCoverage,
        honestGaps: result.gapAnalysis.honestGaps || [],
        warnings: result.gapAnalysis.warnings || [],
      },
      message: 'Analysis complete. Review gaps and approve to continue.',
      nextSteps: [
        'GET /api/v2.1/pipeline/status?sessionId=<id> - Check status',
        'POST /api/v2/approve - Approve and proceed to generation',
        'POST /api/v2.1/pipeline/generate - Generate resume',
      ],
    });
  } catch (error) {
    console.error('V2.1 Pipeline start error:', error);

    // Mark session as failed if it was created
    if (pipeline) {
      try {
        const sessionId = pipeline.getSessionId();
        const [session] = await db
          .select()
          .from(sessions)
          .where(eq(sessions.id, sessionId));

        if (session?.v2Session) {
          // Mark session as failed - use simple update to avoid type issues
          await db
            .update(sessions)
            .set({
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
