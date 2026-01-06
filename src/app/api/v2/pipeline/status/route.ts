// ============================================
// ResumeOS V2: Pipeline Status Endpoint
// ============================================
//
// Returns the current status of a pipeline session,
// including timing and cost information.

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sessions } from '@/drizzle/schema';
import { eq } from 'drizzle-orm';
import type { PipelineSession, PipelineDiagnostics } from '@/types/v2';

export async function GET(request: NextRequest) {
  try {
    const sessionId = request.nextUrl.searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json(
        { error: 'sessionId is required' },
        { status: 400 }
      );
    }

    const [row] = await db
      .select()
      .from(sessions)
      .where(eq(sessions.id, sessionId));

    if (!row) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    const v2Session = row.v2Session as PipelineSession | null;
    const diagnostics = row.v2Diagnostics as PipelineDiagnostics | null;

    if (!v2Session) {
      return NextResponse.json(
        { error: 'No V2 session data found' },
        { status: 400 }
      );
    }

    // Build cost breakdown by agent
    const costsByAgent: Record<string, number> = {};
    for (const entry of diagnostics?.costs?.byAgent || []) {
      costsByAgent[entry.agent] = entry.costUSD;
    }

    // Build timing breakdown by agent
    const timingsByAgent: Record<string, number> = {};
    for (const entry of diagnostics?.timing?.agentTimings || []) {
      timingsByAgent[entry.agent] = entry.durationMs;
    }

    return NextResponse.json({
      success: true,
      sessionId,
      state: v2Session.state,
      createdAt: v2Session.createdAt,
      updatedAt: v2Session.updatedAt,

      // Summary info
      hasStrategy: !!v2Session.jdStrategy,
      hasSelection: !!v2Session.sourceSelection,
      hasGapAnalysis: !!v2Session.gapAnalysis,
      hasWriterOutput: !!v2Session.writerOutput,
      hasValidation: !!v2Session.validationResult,

      // Cost summary
      costs: {
        totalUSD: diagnostics?.costs?.totalUSD || 0,
        byAgent: costsByAgent,
      },

      // Timing summary
      timing: {
        totalMs: diagnostics?.timing?.totalDurationMs || 0,
        contentSelectionMs: diagnostics?.timing?.contentSelectionMs || 0,
        byAgent: timingsByAgent,
      },

      // Validation summary (if available)
      validation: v2Session.validationResult
        ? {
            passed: v2Session.validationResult.passed,
            overallScore: v2Session.validationResult.overallScore,
            honestyPassed: v2Session.validationResult.honesty.passed,
            coveragePassed: v2Session.validationResult.coverage.passed,
            qualityPassed: v2Session.validationResult.quality.passed,
            issueCount: v2Session.validationResult.suggestedFixes.length,
          }
        : null,

      // Error info (if any)
      error: v2Session.error || null,
    });
  } catch (error) {
    console.error('Pipeline status error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to get status',
      },
      { status: 500 }
    );
  }
}
