// ============================================
// ResumeOS V2: Source Swap Endpoint
// ============================================
//
// Allows user to swap a content source for an alternative within a slot.
// Records the swap in the session for the writer to respect.

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sessions } from '@/drizzle/schema';
import { eq } from 'drizzle-orm';
import type { PipelineSession, UserAdjustments } from '@/types/v2';

interface SwapRequest {
  sessionId: string;
  slot: string; // e.g., "ch_1", "p1_bullet_2", "summary"
  fromSourceId: string; // Current top selection
  toSourceId: string; // New preferred selection
}

export async function POST(request: NextRequest) {
  try {
    const body: SwapRequest = await request.json();
    const { sessionId, slot, fromSourceId, toSourceId } = body;

    if (!sessionId || !slot || !fromSourceId || !toSourceId) {
      return NextResponse.json(
        { error: 'sessionId, slot, fromSourceId, and toSourceId are required' },
        { status: 400 }
      );
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

    // Initialize or get user adjustments
    const userAdjustments: UserAdjustments = v2Session.userAdjustments || {
      slotContext: [],
      globalInstructions: '',
      acknowledgedGaps: [],
    };

    // Find or create slot context for this slot
    let slotCtx = userAdjustments.slotContext.find((s) => s.slotId === slot);
    if (!slotCtx) {
      slotCtx = {
        slotId: slot,
        additionalContext: '',
        emphasize: [],
        deEmphasize: [],
      };
      userAdjustments.slotContext.push(slotCtx);
    }

    // Record the swap as emphasis instruction
    // We'll store the preferred source as something to emphasize
    if (!slotCtx.emphasize.includes(`prefer:${toSourceId}`)) {
      slotCtx.emphasize.push(`prefer:${toSourceId}`);
    }
    // Mark the original as de-emphasized
    if (!slotCtx.deEmphasize.includes(`deprioritize:${fromSourceId}`)) {
      slotCtx.deEmphasize.push(`deprioritize:${fromSourceId}`);
    }

    // Update session
    const updatedSession: PipelineSession = {
      ...v2Session,
      userAdjustments,
      updatedAt: new Date().toISOString(),
    };

    await db
      .update(sessions)
      .set({
        v2Session: updatedSession,
        updatedAt: new Date(),
      })
      .where(eq(sessions.id, sessionId));

    return NextResponse.json({
      success: true,
      swap: { slot, fromSourceId, toSourceId },
      totalSlotAdjustments: userAdjustments.slotContext.length,
    });
  } catch (error) {
    console.error('Swap source error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to swap source',
      },
      { status: 500 }
    );
  }
}
