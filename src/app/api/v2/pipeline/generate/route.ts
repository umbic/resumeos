// ============================================
// ResumeOS V2: Pipeline Generate Endpoint
// ============================================
//
// Initiates the generation phase of the pipeline:
// - Resume Writer (Agent 3)
// - Validator (Agent 4)
//
// Requires session to be in "approved" state.
// Returns final state: "complete" or "failed".

import { NextRequest, NextResponse } from 'next/server';
import { V2Pipeline } from '@/lib/pipeline/v2-pipeline';

export const maxDuration = 180; // Writer + validator need time

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId } = body as { sessionId: string };

    if (!sessionId) {
      return NextResponse.json(
        { error: 'sessionId is required' },
        { status: 400 }
      );
    }

    const pipeline = new V2Pipeline(sessionId);
    const result = await pipeline.runGenerationPhase();

    const isComplete = result.state === 'complete';

    return NextResponse.json({
      success: isComplete,
      sessionId: result.sessionId,
      state: result.state,
      writerOutput: result.writerOutput,
      validation: result.validation,
      message: isComplete
        ? 'Resume generated and validated successfully'
        : 'Validation failed - see issues in validation.suggestedFixes',
      scores: {
        overall: result.validation.overallScore,
        honesty: result.validation.honesty.score,
        coverage: result.validation.coverage.score,
        quality: result.validation.quality.score,
      },
    });
  } catch (error) {
    console.error('Pipeline generate error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Generation failed',
        details: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}
