import { db } from './db';
import { sessionDiagnostics } from '@/drizzle/schema';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

export interface DiagnosticDecision {
  decision: string;
  reason: string;
  data?: unknown;
}

export interface DiagnosticEvent {
  id: string;
  sessionId: string;
  step: string;
  substep?: string;
  startedAt: Date;
  completedAt?: Date;
  durationMs?: number;
  promptSent?: string;
  responseReceived?: string;
  inputData?: unknown;
  outputData?: unknown;
  decisions: DiagnosticDecision[];
  tokensSent?: number;
  tokensReceived?: number;
  estimatedCost?: number;
  status: 'pending' | 'success' | 'error';
  errorMessage?: string;
}

/**
 * DiagnosticLogger - Tracks all events during resume generation
 *
 * Usage:
 * ```
 * const diagnostics = new DiagnosticLogger(sessionId);
 * const eventId = diagnostics.startEvent('content_selection', 'scoring_ch');
 * diagnostics.logInput(eventId, { jdAnalysis: ... });
 * diagnostics.logDecision(eventId, 'Selected CH-01', 'Highest score: 23', { score: 23 });
 * diagnostics.completeEvent(eventId, { selectedItems: [...] });
 * await diagnostics.saveAll();
 * ```
 */
export class DiagnosticLogger {
  private sessionId: string;
  private events: Map<string, DiagnosticEvent> = new Map();

  constructor(sessionId: string) {
    this.sessionId = sessionId;
  }

  /**
   * Start a new diagnostic event
   */
  startEvent(step: string, substep?: string): string {
    const id = uuidv4();
    const event: DiagnosticEvent = {
      id,
      sessionId: this.sessionId,
      step,
      substep,
      startedAt: new Date(),
      status: 'pending',
      decisions: [],
    };
    this.events.set(id, event);
    return id;
  }

  /**
   * Log the prompt being sent to an LLM
   */
  logPrompt(eventId: string, prompt: string, tokenCount?: number): void {
    const event = this.events.get(eventId);
    if (event) {
      event.promptSent = prompt;
      event.tokensSent = tokenCount;
    }
  }

  /**
   * Log the response received from an LLM
   */
  logResponse(eventId: string, response: string, tokenCount?: number): void {
    const event = this.events.get(eventId);
    if (event) {
      event.responseReceived = response;
      event.tokensReceived = tokenCount;
    }
  }

  /**
   * Log input data for non-LLM steps
   */
  logInput(eventId: string, data: unknown): void {
    const event = this.events.get(eventId);
    if (event) {
      event.inputData = data;
    }
  }

  /**
   * Log output data
   */
  logOutput(eventId: string, data: unknown): void {
    const event = this.events.get(eventId);
    if (event) {
      event.outputData = data;
    }
  }

  /**
   * Log a decision with reasoning
   */
  logDecision(eventId: string, decision: string, reason: string, data?: unknown): void {
    const event = this.events.get(eventId);
    if (event) {
      event.decisions.push({ decision, reason, data });
    }
  }

  /**
   * Complete an event successfully
   */
  completeEvent(eventId: string, outputData?: unknown): void {
    const event = this.events.get(eventId);
    if (event) {
      event.completedAt = new Date();
      event.durationMs = event.completedAt.getTime() - event.startedAt.getTime();
      event.status = 'success';
      if (outputData !== undefined) {
        event.outputData = outputData;
      }

      // Calculate cost estimate
      // Claude Sonnet 4: $3/M input, $15/M output tokens
      if (event.tokensSent || event.tokensReceived) {
        const inputCost = (event.tokensSent || 0) * 0.000003;
        const outputCost = (event.tokensReceived || 0) * 0.000015;
        event.estimatedCost = inputCost + outputCost;
      }
    }
  }

  /**
   * Mark an event as failed
   */
  failEvent(eventId: string, error: string): void {
    const event = this.events.get(eventId);
    if (event) {
      event.completedAt = new Date();
      event.durationMs = event.completedAt.getTime() - event.startedAt.getTime();
      event.status = 'error';
      event.errorMessage = error;
    }
  }

  /**
   * Save all events to the database
   */
  async saveAll(): Promise<void> {
    const events = Array.from(this.events.values());

    for (const event of events) {
      try {
        await db.insert(sessionDiagnostics).values({
          id: event.id,
          sessionId: event.sessionId,
          step: event.step,
          substep: event.substep || null,
          startedAt: event.startedAt,
          completedAt: event.completedAt || null,
          durationMs: event.durationMs || null,
          promptSent: event.promptSent || null,
          responseReceived: event.responseReceived || null,
          inputData: event.inputData || null,
          outputData: event.outputData || null,
          decisions: event.decisions.length > 0 ? event.decisions : null,
          tokensSent: event.tokensSent || null,
          tokensReceived: event.tokensReceived || null,
          // Store cost as microdollars to avoid floating point issues
          estimatedCost: event.estimatedCost ? Math.round(event.estimatedCost * 1_000_000) : null,
          status: event.status,
          errorMessage: event.errorMessage || null,
        });
      } catch (error) {
        console.error(`Failed to save diagnostic event ${event.id}:`, error);
      }
    }
  }

  /**
   * Get a summary of all events for logging
   */
  getSummary(): {
    totalEvents: number;
    totalDurationMs: number;
    totalTokens: number;
    totalCost: number;
    steps: { step: string; substep?: string; status: string; durationMs?: number }[];
  } {
    const events = Array.from(this.events.values());
    return {
      totalEvents: events.length,
      totalDurationMs: events.reduce((sum, e) => sum + (e.durationMs || 0), 0),
      totalTokens: events.reduce(
        (sum, e) => sum + (e.tokensSent || 0) + (e.tokensReceived || 0),
        0
      ),
      totalCost: events.reduce((sum, e) => sum + (e.estimatedCost || 0), 0),
      steps: events.map((e) => ({
        step: e.step,
        substep: e.substep,
        status: e.status,
        durationMs: e.durationMs,
      })),
    };
  }

  /**
   * Get all events (for debugging)
   */
  getEvents(): DiagnosticEvent[] {
    return Array.from(this.events.values());
  }
}

/**
 * Factory function to create a new DiagnosticLogger
 */
export function createDiagnosticLogger(sessionId: string): DiagnosticLogger {
  return new DiagnosticLogger(sessionId);
}

/**
 * Fetch all diagnostics for a session from the database
 * Returns empty array if table doesn't exist yet
 */
export async function getSessionDiagnostics(sessionId: string) {
  try {
    const events = await db
      .select()
      .from(sessionDiagnostics)
      .where(eq(sessionDiagnostics.sessionId, sessionId))
      .orderBy(sessionDiagnostics.startedAt);

    return events;
  } catch (error) {
    // Table might not exist yet - return empty array
    console.warn('[Diagnostics] Could not fetch diagnostics (table may not exist):', error);
    return [];
  }
}

/**
 * Delete all diagnostics for a session (for re-generation)
 * Fails silently if table doesn't exist yet
 */
export async function clearSessionDiagnostics(sessionId: string): Promise<void> {
  try {
    await db
      .delete(sessionDiagnostics)
      .where(eq(sessionDiagnostics.sessionId, sessionId));
  } catch (error) {
    // Table might not exist yet - that's ok, just log and continue
    console.warn('[Diagnostics] Could not clear diagnostics (table may not exist):', error);
  }
}

/**
 * Estimate token count from text (rough approximation)
 * ~4 characters per token for English text
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
