// ============================================================
// ResumeOS V2.1: Session API Endpoint
// GET: Fetch session data
// PATCH: Update session content
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sessions } from '@/drizzle/schema';
import { eq } from 'drizzle-orm';
import type { PipelineSession } from '@/types/v2';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;

    const [row] = await db.select().from(sessions).where(eq(sessions.id, sessionId));

    if (!row) {
      return NextResponse.json(
        { success: false, error: 'Session not found' },
        { status: 404 }
      );
    }

    const v2Session = row.v2Session as unknown as PipelineSession | null;

    if (!v2Session) {
      return NextResponse.json(
        { success: false, error: 'Not a V2.1 session' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      sessionId,
      status: row.v2Status,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      session: v2Session,
    });
  } catch (error) {
    console.error('Error fetching V2.1 session:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch session' },
      { status: 500 }
    );
  }
}

// PATCH: Update session content (manual edits)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    const body = await request.json();
    const { updates } = body;

    if (!updates) {
      return NextResponse.json(
        { success: false, error: 'Missing updates' },
        { status: 400 }
      );
    }

    // Fetch current session
    const [row] = await db.select().from(sessions).where(eq(sessions.id, sessionId));

    if (!row) {
      return NextResponse.json(
        { success: false, error: 'Session not found' },
        { status: 404 }
      );
    }

    const v2Session = row.v2Session as unknown as PipelineSession | null;

    if (!v2Session) {
      return NextResponse.json(
        { success: false, error: 'Not a V2.1 session' },
        { status: 400 }
      );
    }

    // Deep merge updates into session
    const updatedSession = deepMerge(v2Session, updates);

    // Update database
    await db
      .update(sessions)
      .set({
        v2Session: updatedSession as unknown as typeof sessions.$inferSelect['v2Session'],
        updatedAt: new Date(),
      })
      .where(eq(sessions.id, sessionId));

    return NextResponse.json({
      success: true,
      sessionId,
      session: updatedSession,
    });
  } catch (error) {
    console.error('Error updating V2.1 session:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update session' },
      { status: 500 }
    );
  }
}

// Deep merge utility for session updates
function deepMerge(target: unknown, source: unknown): unknown {
  if (
    source === null ||
    typeof source !== 'object' ||
    Array.isArray(source)
  ) {
    return source;
  }

  if (
    target === null ||
    typeof target !== 'object' ||
    Array.isArray(target)
  ) {
    return source;
  }

  const result = { ...(target as Record<string, unknown>) };
  const sourceObj = source as Record<string, unknown>;

  for (const key of Object.keys(sourceObj)) {
    const sourceValue = sourceObj[key];
    const targetValue = result[key];

    if (
      sourceValue !== null &&
      typeof sourceValue === 'object' &&
      !Array.isArray(sourceValue) &&
      targetValue !== null &&
      typeof targetValue === 'object' &&
      !Array.isArray(targetValue)
    ) {
      result[key] = deepMerge(targetValue, sourceValue);
    } else if (sourceValue !== undefined) {
      result[key] = sourceValue;
    }
  }

  return result;
}
