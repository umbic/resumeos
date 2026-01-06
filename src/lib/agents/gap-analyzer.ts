// ============================================
// ResumeOS V2: Agent 2 - Gap Analyzer
// ============================================

import { BaseAgent } from './base-agent';
import { buildGapAnalyzerPrompt } from '../prompts/gap-analyzer-prompt';
import type {
  GapAnalyzerInput,
  GapAnalysis,
} from '@/types/v2';

/**
 * Gap Analyzer Agent
 *
 * Compares JD requirements against selected content and identifies:
 * - Coverage gaps (requirements not addressed)
 * - Positioning alignment (does content support the strategic angle)
 * - Honest gaps (things we cannot address)
 * - Emphasis recommendations (how to optimize existing content)
 *
 * Output is used by:
 * - User for approval/adjustment before writing begins
 * - Resume Writer for emphasis guidance
 */
export class GapAnalyzerAgent extends BaseAgent<GapAnalyzerInput, GapAnalysis> {
  constructor() {
    super('gapAnalyzer');
  }

  buildPrompt(input: GapAnalyzerInput): string {
    return buildGapAnalyzerPrompt(input.jdStrategy, input.sourceSelection);
  }

  parseResponse(response: string): GapAnalysis {
    return this.parseJSON<GapAnalysis>(response);
  }
}
