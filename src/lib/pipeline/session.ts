// ============================================
// ResumeOS V2: Pipeline Session Management
// ============================================

import { db } from '@/lib/db';
import { sessions } from '@/drizzle/schema';
import { eq } from 'drizzle-orm';
import type {
  PipelineSession,
  PipelineState,
  JDStrategy,
  ContentSelectionResult,
  GapAnalysis,
  WriterOutput,
  ValidationResult,
} from '@/types/v2';

/**
 * Create a new V2 pipeline session
 */
export async function createV2Session(
  jobDescription: string,
  companyName?: string,
  targetTitle?: string
): Promise<string> {
  const now = new Date().toISOString();

  const initialSession: PipelineSession = {
    id: '', // Will be set by database
    state: 'analyzing',
    createdAt: now,
    updatedAt: now,
    jobDescription,
    companyName,
    targetTitle,
  };

  const [result] = await db
    .insert(sessions)
    .values({
      jobDescription,
      targetCompany: companyName,
      targetTitle,
      v2Session: initialSession,
      v2Status: 'analyzing',
      generationVersion: 'v2',
    })
    .returning({ id: sessions.id });

  // Update the session with the actual ID
  const sessionId = result.id;
  initialSession.id = sessionId;

  await db
    .update(sessions)
    .set({ v2Session: initialSession })
    .where(eq(sessions.id, sessionId));

  return sessionId;
}

/**
 * Update V2 session state
 */
export async function updateV2SessionState(
  sessionId: string,
  newState: PipelineState,
  updates?: Partial<PipelineSession>
): Promise<void> {
  const [session] = await db
    .select()
    .from(sessions)
    .where(eq(sessions.id, sessionId));

  if (!session || !session.v2Session) {
    throw new Error('Session not found');
  }

  const v2Session = session.v2Session as PipelineSession;

  const updatedSession: PipelineSession = {
    ...v2Session,
    ...updates,
    state: newState,
    updatedAt: new Date().toISOString(),
  };

  await db
    .update(sessions)
    .set({
      v2Session: updatedSession,
      v2Status: newState,
      updatedAt: new Date(),
    })
    .where(eq(sessions.id, sessionId));
}

/**
 * Save JD Strategy to session
 */
export async function saveJDStrategy(
  sessionId: string,
  strategy: JDStrategy
): Promise<void> {
  await updateV2SessionState(sessionId, 'selecting', {
    jdStrategy: strategy,
  });
}

/**
 * Save content selection to session
 */
export async function saveContentSelection(
  sessionId: string,
  selection: ContentSelectionResult
): Promise<void> {
  const [session] = await db
    .select()
    .from(sessions)
    .where(eq(sessions.id, sessionId));

  if (!session || !session.v2Session) {
    throw new Error('Session not found');
  }

  const v2Session = session.v2Session as PipelineSession;

  const updatedSession: PipelineSession = {
    ...v2Session,
    sourceSelection: selection,
    updatedAt: new Date().toISOString(),
  };

  await db
    .update(sessions)
    .set({
      v2Session: updatedSession,
      updatedAt: new Date(),
    })
    .where(eq(sessions.id, sessionId));
}

/**
 * Save gap analysis to session and transition to gap-review state
 */
export async function saveGapAnalysis(
  sessionId: string,
  gapAnalysis: GapAnalysis
): Promise<void> {
  await updateV2SessionState(sessionId, 'gap-review', {
    gapAnalysis,
  });
}

/**
 * Save writer output to session
 */
export async function saveWriterOutput(
  sessionId: string,
  writerOutput: WriterOutput
): Promise<void> {
  await updateV2SessionState(sessionId, 'validating', {
    writerOutput,
  });
}

/**
 * Save validation result to session
 */
export async function saveValidationResult(
  sessionId: string,
  validationResult: ValidationResult
): Promise<void> {
  await updateV2SessionState(sessionId, 'complete', {
    validationResult,
  });
}

/**
 * Mark session as failed
 */
export async function markSessionFailed(
  sessionId: string,
  stage: PipelineState,
  errorMessage: string
): Promise<void> {
  const [session] = await db
    .select()
    .from(sessions)
    .where(eq(sessions.id, sessionId));

  if (!session || !session.v2Session) {
    throw new Error('Session not found');
  }

  const v2Session = session.v2Session as PipelineSession;

  const updatedSession: PipelineSession = {
    ...v2Session,
    state: 'failed',
    error: {
      stage,
      message: errorMessage,
      timestamp: new Date().toISOString(),
    },
    updatedAt: new Date().toISOString(),
  };

  await db
    .update(sessions)
    .set({
      v2Session: updatedSession,
      v2Status: 'failed',
      updatedAt: new Date(),
    })
    .where(eq(sessions.id, sessionId));
}

/**
 * Get V2 session data
 */
export async function getV2Session(sessionId: string): Promise<PipelineSession | null> {
  const [session] = await db
    .select()
    .from(sessions)
    .where(eq(sessions.id, sessionId));

  if (!session) {
    return null;
  }

  return session.v2Session as PipelineSession | null;
}
