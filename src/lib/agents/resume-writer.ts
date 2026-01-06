// ============================================
// ResumeOS V2: Agent 3 - Resume Writer
// ============================================

import { BaseAgent } from './base-agent';
import { buildResumeWriterPrompt } from '../prompts/resume-writer-prompt';
import type {
  JDStrategy,
  ContentSelectionResult,
  GapAnalysis,
  UserAdjustments,
  WriterOutput,
} from '@/types/v2';

/**
 * Input for the Resume Writer agent
 */
export interface ResumeWriterInput {
  strategy: JDStrategy;
  selection: ContentSelectionResult;
  gapAnalysis: GapAnalysis;
  userAdjustments: UserAdjustments | null;
}

/**
 * Resume Writer Agent
 *
 * Writes FRESH content for the entire resume using source material as
 * the factual foundation. Every metric, client name, and outcome must
 * trace back to source material.
 *
 * Key constraints:
 * - Every fact must come from sources (metrics, clients, outcomes)
 * - Can reframe, restructure, and combine angles
 * - Cannot invent new claims
 * - Must follow positioning strategy
 * - Must incorporate JD language naturally
 *
 * Output is used by:
 * - Validator agent for honesty/quality checks
 * - Export system for final document generation
 */
export class ResumeWriterAgent extends BaseAgent<ResumeWriterInput, WriterOutput> {
  constructor() {
    super('resumeWriter');
  }

  buildPrompt(input: ResumeWriterInput): string {
    return buildResumeWriterPrompt(
      input.strategy,
      input.selection,
      input.gapAnalysis,
      input.userAdjustments
    );
  }

  parseResponse(response: string): WriterOutput {
    return this.parseJSON<WriterOutput>(response);
  }
}
