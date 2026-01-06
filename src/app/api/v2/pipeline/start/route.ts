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

export const maxDuration = 120; // Analysis phase can take time

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { jobDescription } = body as { jobDescription: string };

    if (!jobDescription || jobDescription.trim().length < 100) {
      return NextResponse.json(
        { error: 'Job description is required (min 100 characters)' },
        { status: 400 }
      );
    }

    const pipeline = new V2Pipeline();
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
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Pipeline failed to start',
        details: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}
