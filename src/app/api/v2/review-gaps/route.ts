// ============================================
// ResumeOS V2: Gap Review Endpoint
// ============================================
//
// Returns the current gap analysis and selected content for UI display.
// Users review this before approving resume generation.

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sessions } from '@/drizzle/schema';
import { eq } from 'drizzle-orm';
import type { PipelineSession } from '@/types/v2';

export async function GET(request: NextRequest) {
  try {
    const sessionId = request.nextUrl.searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });
    }

    // Fetch session from database
    const [session] = await db
      .select()
      .from(sessions)
      .where(eq(sessions.id, sessionId));

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const v2Session = session.v2Session as PipelineSession | null;

    if (!v2Session) {
      return NextResponse.json(
        { error: 'No V2 session data found' },
        { status: 400 }
      );
    }

    if (v2Session.state === 'analyzing' || v2Session.state === 'selecting') {
      return NextResponse.json(
        { error: 'Gap analysis not yet complete', currentState: v2Session.state },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      sessionId,
      state: v2Session.state,
      strategy: v2Session.jdStrategy,
      selection: v2Session.sourceSelection,
      gapAnalysis: v2Session.gapAnalysis,
      userAdjustments: v2Session.userAdjustments || {
        slotContext: [],
        globalInstructions: '',
        acknowledgedGaps: [],
      },
    });
  } catch (error) {
    console.error('Review gaps error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to fetch review data',
      },
      { status: 500 }
    );
  }
}
