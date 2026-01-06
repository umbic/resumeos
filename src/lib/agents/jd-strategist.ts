// ============================================
// ResumeOS V2: Agent 1 - JD Strategist
// ============================================

import { BaseAgent } from './base-agent';
import { buildJDStrategistPrompt } from '../prompts/jd-strategist-prompt';
import type { JDStrategistInput, JDStrategy } from '@/types/v2';

/**
 * JD Strategist Agent
 *
 * Analyzes a job description and produces a comprehensive positioning strategy
 * that directs the entire resume generation pipeline.
 *
 * Output is used by:
 * - Content Selection (scoring signals)
 * - Gap Analyzer (requirements list)
 * - Resume Writer (positioning angles, language guidance)
 */
export class JDStrategistAgent extends BaseAgent<JDStrategistInput, JDStrategy> {
  constructor() {
    super('jdStrategist');
  }

  buildPrompt(input: JDStrategistInput): string {
    return buildJDStrategistPrompt(input);
  }

  parseResponse(response: string): JDStrategy {
    return this.parseJSON<JDStrategy>(response);
  }
}
