import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { addressGap } from '@/lib/gap-detection';
import type { GeneratedResume, Gap } from '@/types';

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
      SELECT generated_resume, gaps
      FROM sessions
      WHERE id = ${sessionId}
    `;

    if (sessionResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    const session = sessionResult.rows[0];
    const resume = session.generated_resume as GeneratedResume;
    const gaps = (session.gaps || []) as Gap[];

    if (!resume) {
      return NextResponse.json(
        { error: 'No generated resume found' },
        { status: 400 }
      );
    }

    // Find the specific gap
    const gap = gaps.find(g => g.id === gapId);
    if (!gap) {
      return NextResponse.json(
        { error: 'Gap not found' },
        { status: 404 }
      );
    }

    if (!gap.recommendation) {
      return NextResponse.json(
        { error: 'This gap has no recommendation to address' },
        { status: 400 }
      );
    }

    // Address the gap
    const updatedResume = await addressGap(sessionId, gapId, resume, gap);

    // Update gap status
    const updatedGaps = gaps.map(g =>
      g.id === gapId ? { ...g, status: 'addressed' as const } : g
    );

    // Save to database
    await sql`
      UPDATE sessions
      SET
        generated_resume = ${JSON.stringify(updatedResume)}::jsonb,
        gaps = ${JSON.stringify(updatedGaps)}::jsonb,
        updated_at = NOW()
      WHERE id = ${sessionId}
    `;

    return NextResponse.json({
      success: true,
      resume: updatedResume,
      gaps: updatedGaps,
    });

  } catch (error) {
    console.error('Address gap error:', error);
    return NextResponse.json(
      { error: 'Failed to address gap', details: String(error) },
      { status: 500 }
    );
  }
}
