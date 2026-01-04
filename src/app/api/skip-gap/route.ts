import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import type { Gap } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const { sessionId, gapId } = await request.json();

    if (!sessionId || !gapId) {
      return NextResponse.json(
        { error: 'sessionId and gapId are required' },
        { status: 400 }
      );
    }

    // Get session
    const sessionResult = await sql`
      SELECT gaps FROM sessions WHERE id = ${sessionId}
    `;

    if (sessionResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    const gaps = (sessionResult.rows[0].gaps || []) as Gap[];

    // Find the gap to verify it exists
    const gap = gaps.find(g => g.id === gapId);
    if (!gap) {
      return NextResponse.json(
        { error: 'Gap not found' },
        { status: 404 }
      );
    }

    // Update gap status to skipped
    const updatedGaps = gaps.map(g =>
      g.id === gapId ? { ...g, status: 'skipped' as const } : g
    );

    await sql`
      UPDATE sessions
      SET
        gaps = ${JSON.stringify(updatedGaps)}::jsonb,
        updated_at = NOW()
      WHERE id = ${sessionId}
    `;

    return NextResponse.json({
      success: true,
      gaps: updatedGaps,
    });

  } catch (error) {
    console.error('Skip gap error:', error);
    return NextResponse.json(
      { error: 'Failed to skip gap', details: String(error) },
      { status: 500 }
    );
  }
}
