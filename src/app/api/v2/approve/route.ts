// ============================================
// ResumeOS V2: Approval Endpoint
// ============================================
//
// User approves the content selection after reviewing gaps.
// This unlocks the Resume Writer agent.

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sessions } from '@/drizzle/schema';
import { eq } from 'drizzle-orm';
import type { PipelineSession, UserAdjustments } from '@/types/v2';

interface ApproveRequest {
  sessionId: string;
  globalInstructions?: string; // Optional notes for the writer
  acknowledgedGaps?: string[]; // Gaps the user explicitly acknowledges
}

export async function POST(request: NextRequest) {
  try {
    const body: ApproveRequest = await request.json();
    const { sessionId, globalInstructions, acknowledgedGaps } = body;

    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });
    }

    // Fetch session
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

    if (v2Session.state !== 'gap-review') {
      return NextResponse.json(
        {
          error: 'Session is not in gap-review state',
          currentState: v2Session.state,
        },
        { status: 400 }
      );
    }

    // Update user adjustments with final approval info
    const userAdjustments: UserAdjustments = v2Session.userAdjustments || {
      slotContext: [],
      globalInstructions: '',
      acknowledgedGaps: [],
    };

    if (globalInstructions) {
      userAdjustments.globalInstructions = globalInstructions;
    }

    if (acknowledgedGaps && acknowledgedGaps.length > 0) {
      const combined = [...userAdjustments.acknowledgedGaps, ...acknowledgedGaps];
      userAdjustments.acknowledgedGaps = Array.from(new Set(combined));
    }

    // Transition to approved state
    const updatedSession: PipelineSession = {
      ...v2Session,
      state: 'approved',
      userAdjustments,
      updatedAt: new Date().toISOString(),
    };

    await db
      .update(sessions)
      .set({
        v2Session: updatedSession,
        v2Status: 'approved',
        updatedAt: new Date(),
      })
      .where(eq(sessions.id, sessionId));

    return NextResponse.json({
      success: true,
      sessionId,
      state: 'approved',
      message: 'Ready for resume generation',
      slotAdjustments: userAdjustments.slotContext.length,
      acknowledgedGaps: userAdjustments.acknowledgedGaps.length,
      hasGlobalInstructions: !!userAdjustments.globalInstructions,
    });
  } catch (error) {
    console.error('Approve error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to approve' },
      { status: 500 }
    );
  }
}
