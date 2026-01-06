import Anthropic from '@anthropic-ai/sdk';
import { AGENT_CONFIG, calculateCost } from './config';
import { JDStrategy } from '@/types/v2';
import {
  ContentAllocation,
  NarrativeWriterOutput,
  DetailWriterOutput,
  ValidationResultV21,
  ValidationIssueV21,
  MetricVerificationV21,
  RequirementCoverageV21,
} from '@/types/v2.1';
import { buildValidatorPromptV21 } from '../prompts/validator-prompt-v21';
import {
  runFormatChecks,
  calculateFormatScore,
  generateFormatIssues,
} from '../validators/format-checker';

export interface ValidatorV21Input {
  strategy: JDStrategy;
  allocation: ContentAllocation;
  narrativeOutput: NarrativeWriterOutput;
  detailOutput: DetailWriterOutput;
}

export interface ValidatorV21Diagnostics {
  promptSent: string;
  rawResponse: string;
  inputTokens: number;
  outputTokens: number;
  cost: number;
  durationMs: number;
}

export interface ValidatorV21Result {
  validation: ValidationResultV21;
  diagnostics: ValidatorV21Diagnostics;
}

interface LLMValidatorResponse {
  honestyScore: number;
  coverageScore: number;
  qualityScore: number;
  metricsVerification: MetricVerificationV21[];
  requirementsCoverage: RequirementCoverageV21[];
  issues: ValidationIssueV21[];
}

export class ValidatorAgentV21 {
  private client: Anthropic;
  private name = 'Validator V2.1';

  constructor() {
    this.client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }

  async run(input: ValidatorV21Input): Promise<ValidatorV21Result> {
    const startTime = Date.now();

    // Step 1: Run format checks (code-based, no LLM)
    console.log(`[${this.name}] Running format checks...`);
    const formatChecks = runFormatChecks(input.narrativeOutput, input.detailOutput);
    const formatScore = calculateFormatScore(formatChecks);
    const formatIssues = generateFormatIssues(formatChecks);

    console.log(`[${this.name}] Format score: ${formatScore}/10`);
    if (formatIssues.length > 0) {
      console.log(`[${this.name}] Found ${formatIssues.length} format issues`);
    }

    // Step 2: Run LLM validation for honesty, coverage, quality
    console.log(`[${this.name}] Running LLM validation...`);
    const prompt = buildValidatorPromptV21(
      input.strategy,
      input.allocation,
      input.narrativeOutput,
      input.detailOutput
    );

    const response = await this.client.messages.create({
      model: AGENT_CONFIG.model,
      max_tokens: AGENT_CONFIG.maxTokens.validator || 3000,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const durationMs = Date.now() - startTime;
    const rawResponse =
      response.content[0].type === 'text' ? response.content[0].text : '';

    const inputTokens = response.usage?.input_tokens || 0;
    const outputTokens = response.usage?.output_tokens || 0;
    const cost = calculateCost(inputTokens, outputTokens);

    console.log(
      `[${this.name}] Complete. Tokens: ${inputTokens}/${outputTokens}, Cost: $${cost.toFixed(3)}, Duration: ${durationMs}ms`
    );

    // Parse LLM response
    const llmResult = this.parseResponse(rawResponse);

    // Step 3: Combine format and LLM validation results
    const allIssues: ValidationIssueV21[] = [
      ...formatIssues,
      ...llmResult.issues,
    ];

    // Count issues by severity
    const blockers = allIssues.filter(i => i.severity === 'blocker').length;
    const warnings = allIssues.filter(i => i.severity === 'warning').length;
    const suggestions = allIssues.filter(i => i.severity === 'suggestion').length;

    // Determine overall verdict
    let overallVerdict: 'pass' | 'pass-with-warnings' | 'fail' = 'pass';
    if (blockers > 0) {
      overallVerdict = 'fail';
    } else if (warnings > 0) {
      overallVerdict = 'pass-with-warnings';
    }

    const validation: ValidationResultV21 = {
      overallVerdict,
      honestyScore: llmResult.honestyScore,
      coverageScore: llmResult.coverageScore,
      qualityScore: llmResult.qualityScore,
      formatScore,
      formatChecks,
      issues: allIssues,
      metricsVerification: llmResult.metricsVerification,
      requirementsCoverage: llmResult.requirementsCoverage,
      summary: {
        totalIssues: allIssues.length,
        blockers,
        warnings,
        suggestions,
      },
    };

    return {
      validation,
      diagnostics: {
        promptSent: prompt,
        rawResponse,
        inputTokens,
        outputTokens,
        cost,
        durationMs,
      },
    };
  }

  private parseResponse(response: string): LLMValidatorResponse {
    // Clean up response - remove markdown code blocks if present
    let cleaned = response.trim();
    if (cleaned.startsWith('```json')) {
      cleaned = cleaned.slice(7);
    } else if (cleaned.startsWith('```')) {
      cleaned = cleaned.slice(3);
    }
    if (cleaned.endsWith('```')) {
      cleaned = cleaned.slice(0, -3);
    }
    cleaned = cleaned.trim();

    try {
      const parsed = JSON.parse(cleaned);

      // Validate required fields
      return {
        honestyScore: parsed.honestyScore ?? 5,
        coverageScore: parsed.coverageScore ?? 5,
        qualityScore: parsed.qualityScore ?? 5,
        metricsVerification: parsed.metricsVerification || [],
        requirementsCoverage: parsed.requirementsCoverage || [],
        issues: parsed.issues || [],
      };
    } catch (error) {
      // Try to extract JSON object if there's other text around it
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          return {
            honestyScore: parsed.honestyScore ?? 5,
            coverageScore: parsed.coverageScore ?? 5,
            qualityScore: parsed.qualityScore ?? 5,
            metricsVerification: parsed.metricsVerification || [],
            requirementsCoverage: parsed.requirementsCoverage || [],
            issues: parsed.issues || [],
          };
        } catch {
          // Fall through to throw original error
        }
      }
      console.error(
        `[${this.name}] Failed to parse response:`,
        cleaned.substring(0, 500)
      );
      throw new Error(`Failed to parse ${this.name} response as JSON: ${error}`);
    }
  }
}
