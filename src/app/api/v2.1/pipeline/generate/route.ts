// ============================================================
// ResumeOS V2.1: Pipeline Generate Endpoint
// ============================================================
//
// Runs the generation phase of the V2.1 pipeline:
// - Narrative Writer (Phase 1) <- NEW in V2.1
// - Detail Writer (Phase 2) <- NEW in V2.1
// - Validator
// - Assembler
//
// Requires session to be in "approved" state.

import { NextRequest, NextResponse } from 'next/server';
import { V21Pipeline } from '@/lib/pipeline/v2.1-pipeline';
import { db } from '@/lib/db';
import { sessions } from '@/drizzle/schema';
import { eq } from 'drizzle-orm';

export const maxDuration = 240; // Generation phase needs more time

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId } = body as { sessionId: string };

    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });
    }

    // Check session exists and is approved
    const [row] = await db.select().from(sessions).where(eq(sessions.id, sessionId));

    if (!row) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    if (row.v2Status !== 'approved') {
      return NextResponse.json(
        {
          error: `Session status is '${row.v2Status}', must be 'approved' to generate`,
          currentStatus: row.v2Status,
        },
        { status: 400 }
      );
    }

    const pipeline = new V21Pipeline(sessionId);
    const result = await pipeline.runGenerationPhase();

    return NextResponse.json({
      success: true,
      sessionId: result.sessionId,
      status: result.status,
      resume: result.resume,
      resumeMarkdown: result.resumeMarkdown,
      validation: {
        verdict: result.validation.overallVerdict,
        scores: {
          honesty: result.validation.honestyScore,
          coverage: result.validation.coverageScore,
          quality: result.validation.qualityScore,
          format: result.validation.formatScore,
        },
        issues: result.validation.summary,
      },
      costs: {
        total: result.diagnostics.totalCost,
        breakdown: result.diagnostics.agents,
      },
    });
  } catch (error) {
    console.error('V2.1 Pipeline generate error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Pipeline generate failed' },
      { status: 500 }
    );
  }
}
