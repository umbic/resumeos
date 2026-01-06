// ============================================================
// ResumeOS V2.1: Pipeline Status Endpoint
// ============================================================
//
// Returns the current status and data for a V2.1 pipeline session.

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sessions } from '@/drizzle/schema';
import { eq } from 'drizzle-orm';
import type { PipelineDiagnostics } from '@/lib/pipeline/v2.1-pipeline';

export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get('sessionId');

  if (!sessionId) {
    return NextResponse.json(
      { error: 'sessionId query parameter required' },
      { status: 400 }
    );
  }

  const [row] = await db.select().from(sessions).where(eq(sessions.id, sessionId));

  if (!row) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  const session = row.v2Session as Record<string, unknown> | null;
  const diagnostics = row.v2Diagnostics as PipelineDiagnostics | null;

  return NextResponse.json({
    sessionId,
    status: row.v2Status,
    createdAt: session?.createdAt,
    profileId: session?.profileId,
    hasJdStrategy: !!session?.jdStrategy,
    hasAllocation: !!(session?.allocation || session?.contentAllocation),
    hasGapAnalysis: !!session?.gapAnalysis,
    hasNarrativeOutput: !!session?.narrativeOutput,
    hasDetailOutput: !!session?.detailOutput,
    hasValidation: !!session?.validation,
    hasAssembledResume: !!session?.assembledResume,
    costs: {
      total: diagnostics?.totalCost || 0,
      agents: diagnostics?.agents || {},
    },
  });
}
