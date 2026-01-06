// ============================================
// ResumeOS V2: Agent 4 - Validator
// ============================================

import { BaseAgent } from './base-agent';
import { buildValidatorPrompt } from '../prompts/validator-prompt';
import type {
  JDStrategy,
  ContentSelectionResult,
  WriterOutput,
  ValidationResult,
} from '@/types/v2';

/**
 * Input for the Validator agent
 */
export interface ValidatorInput {
  strategy: JDStrategy;
  selection: ContentSelectionResult;
  writerOutput: WriterOutput;
}

/**
 * Validator Agent
 *
 * Validates the written resume against source material and JD requirements.
 * Checks for:
 * - Honesty: Metrics, clients, outcomes must match sources exactly
 * - Coverage: Must-have requirements should be addressed
 * - Quality: Verb variety, bullet length, language quality
 * - Positioning: Resume should support the strategic angle
 *
 * Key principles:
 * - Strict on honesty (any metric modification = blocker)
 * - Pragmatic on coverage (not all requirements need equal weight)
 * - Actionable fixes (every issue has a suggested fix)
 *
 * Output determines:
 * - If validation passes → session moves to "complete"
 * - If validation fails → session moves to "failed" with issues
 */
export class ValidatorAgent extends BaseAgent<ValidatorInput, ValidationResult> {
  constructor() {
    super('validator');
  }

  buildPrompt(input: ValidatorInput): string {
    return buildValidatorPrompt(
      input.strategy,
      input.selection,
      input.writerOutput
    );
  }

  parseResponse(response: string): ValidationResult {
    return this.parseJSON<ValidationResult>(response);
  }
}
