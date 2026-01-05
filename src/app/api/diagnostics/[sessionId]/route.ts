import { NextRequest, NextResponse } from 'next/server';
import { getSessionDiagnostics } from '@/lib/diagnostics';
import { db } from '@/lib/db';
import { sessions, SessionDiagnostic } from '@/drizzle/schema';
import { eq } from 'drizzle-orm';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;

    // Verify session exists
    const session = await db
      .select()
      .from(sessions)
      .where(eq(sessions.id, sessionId))
      .limit(1);

    if (session.length === 0) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Fetch diagnostics
    const diagnostics = await getSessionDiagnostics(sessionId);

    // Calculate summary stats
    const summary = {
      totalEvents: diagnostics.length,
      totalDurationMs: diagnostics.reduce((sum, d) => sum + (d.durationMs || 0), 0),
      totalTokensSent: diagnostics.reduce((sum, d) => sum + (d.tokensSent || 0), 0),
      totalTokensReceived: diagnostics.reduce((sum, d) => sum + (d.tokensReceived || 0), 0),
      // Convert from microdollars back to dollars
      estimatedTotalCost: diagnostics.reduce(
        (sum, d) => sum + ((d.estimatedCost || 0) / 1_000_000),
        0
      ),
      hasErrors: diagnostics.some((d) => d.status === 'error'),
    };

    // Group by step
    const byStep = diagnostics.reduce(
      (acc, d) => {
        const key = d.step;
        if (!acc[key]) acc[key] = [];
        acc[key].push(d);
        return acc;
      },
      {} as Record<string, SessionDiagnostic[]>
    );

    return NextResponse.json({
      sessionId,
      summary,
      byStep,
      events: diagnostics,
    });
  } catch (error) {
    console.error('Error fetching diagnostics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch diagnostics' },
      { status: 500 }
    );
  }
}
