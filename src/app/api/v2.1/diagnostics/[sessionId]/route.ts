// ============================================================
// ResumeOS V2.1: Diagnostics API Endpoint
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sessions } from '@/drizzle/schema';
import { eq } from 'drizzle-orm';

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

    const v2Session = row.v2Session as unknown as Record<string, unknown> | null;
    const v2Diagnostics = row.v2Diagnostics as unknown as Record<string, unknown> | null;

    return NextResponse.json({
      success: true,
      sessionId,
      status: row.v2Status,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      session: v2Session,
      diagnostics: v2Diagnostics,
    });
  } catch (error) {
    console.error('Error fetching V2.1 diagnostics:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch diagnostics' },
      { status: 500 }
    );
  }
}
