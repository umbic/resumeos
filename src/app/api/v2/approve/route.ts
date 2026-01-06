// ============================================
// ResumeOS V2/V2.1: Approval Endpoint
// ============================================
//
// User approves the content selection after reviewing gaps.
// This unlocks the Resume Writer agent (V2) or Narrative Writer (V2.1).
//
// Works with both V2 (uses v2Session.state) and V2.1 (uses v2Status column)

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sessions } from '@/drizzle/schema';
import { eq } from 'drizzle-orm';
import type { PipelineSession, UserAdjustments } from '@/types/v2';

interface ApproveRequest {
  sessionId: string;
  globalInstructions?: string; // Optional notes for the writer
  acknowledgedGaps?: string[]; // Gaps the user explicitly acknowledges
  additionalContext?: string; // V2.1: additional context for writers
}

export async function POST(request: NextRequest) {
  try {
    const body: ApproveRequest = await request.json();
    const { sessionId, globalInstructions, acknowledgedGaps, additionalContext } = body;

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

    const v2Session = session.v2Session as Record<string, unknown> | null;

    if (!v2Session) {
      return NextResponse.json(
        { error: 'No V2 session data found' },
        { status: 400 }
      );
    }

    // Check status - support both V2 (state) and V2.1 (status/v2Status column)
    const currentStatus = session.v2Status || (v2Session.state as string) || (v2Session.status as string);

    if (currentStatus !== 'gap-review') {
      return NextResponse.json(
        {
          error: 'Session is not in gap-review state',
          currentState: currentStatus,
        },
        { status: 400 }
      );
    }

    // Check if this is a V2.1 session (has allocation or contentAllocation)
    const isV21 = !!(v2Session.allocation || v2Session.contentAllocation);

    if (isV21) {
      // V2.1: Update with simpler userAdjustments structure
      const updatedSession = {
        ...v2Session,
        status: 'approved',
        userAdjustments: {
          ...(v2Session.userAdjustments as Record<string, unknown> || {}),
          additionalContext,
          globalInstructions,
          acknowledgedGaps,
          approvedAt: new Date().toISOString(),
        },
        updatedAt: new Date().toISOString(),
      };

      await db
        .update(sessions)
        .set({
          v2Session: updatedSession as unknown as PipelineSession,
          v2Status: 'approved',
          updatedAt: new Date(),
        })
        .where(eq(sessions.id, sessionId));

      return NextResponse.json({
        success: true,
        sessionId,
        status: 'approved',
        message: 'Session approved. Ready for generation.',
      });
    } else {
      // V2: Original logic with full UserAdjustments structure
      const pipelineSession = v2Session as unknown as PipelineSession;

      const userAdjustments: UserAdjustments = pipelineSession.userAdjustments || {
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
        ...pipelineSession,
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
    }
  } catch (error) {
    console.error('Approve error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to approve' },
      { status: 500 }
    );
  }
}
