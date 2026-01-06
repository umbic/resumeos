import Anthropic from '@anthropic-ai/sdk';
import { AGENT_CONFIG, calculateCost } from './config';
import { JDStrategy } from '@/types/v2';
import { ContentAllocation, NarrativeWriterOutput, DetailWriterOutput } from '@/types/v2.1';
import { buildDetailWriterPrompt } from '../prompts/detail-writer-prompt';

export interface DetailWriterInput {
  strategy: JDStrategy;
  allocation: ContentAllocation;
  phase1Output: NarrativeWriterOutput;
}

export interface DetailWriterDiagnostics {
  promptSent: string;
  rawResponse: string;
  inputTokens: number;
  outputTokens: number;
  cost: number;
  durationMs: number;
}

export interface DetailWriterResult {
  output: DetailWriterOutput;
  diagnostics: DetailWriterDiagnostics;
}

export class DetailWriterAgent {
  private client: Anthropic;
  private name = 'Detail Writer';

  constructor() {
    this.client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }

  async run(input: DetailWriterInput): Promise<DetailWriterResult> {
    const startTime = Date.now();
    const prompt = buildDetailWriterPrompt(
      input.strategy,
      input.allocation,
      input.phase1Output
    );

    console.log(`[${this.name}] Starting...`);
    console.log(`[${this.name}] Banned verbs from Phase 1: ${input.phase1Output.metadata.usedVerbs.join(', ')}`);

    const response = await this.client.messages.create({
      model: AGENT_CONFIG.model,
      max_tokens: AGENT_CONFIG.maxTokens.detailWriter || 3000,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    });

    const durationMs = Date.now() - startTime;
    const rawResponse = response.content[0].type === 'text'
      ? response.content[0].text
      : '';

    const inputTokens = response.usage?.input_tokens || 0;
    const outputTokens = response.usage?.output_tokens || 0;
    const cost = calculateCost(inputTokens, outputTokens);

    console.log(`[${this.name}] Complete. Tokens: ${inputTokens}/${outputTokens}, Cost: $${cost.toFixed(3)}, Duration: ${durationMs}ms`);

    // Parse the response
    const output = this.parseResponse(rawResponse);

    // Validate output
    this.validateOutput(output, input.phase1Output.metadata.usedVerbs);

    return {
      output,
      diagnostics: {
        promptSent: prompt,
        rawResponse,
        inputTokens,
        outputTokens,
        cost,
        durationMs
      }
    };
  }

  private parseResponse(response: string): DetailWriterOutput {
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
      return JSON.parse(cleaned) as DetailWriterOutput;
    } catch (error) {
      // Try to extract JSON object if there's other text around it
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          return JSON.parse(jsonMatch[0]) as DetailWriterOutput;
        } catch {
          // Fall through to throw original error
        }
      }
      console.error(`[${this.name}] Failed to parse response:`, cleaned.substring(0, 500));
      throw new Error(`Failed to parse ${this.name} response as JSON: ${error}`);
    }
  }

  private validateOutput(output: DetailWriterOutput, bannedVerbs: string[]): void {
    const bannedLower = bannedVerbs.map(v => v.toLowerCase());

    // Validate P1
    if (!output.position1?.overview?.content) {
      throw new Error('Detail Writer output missing Position 1 overview');
    }
    if (!output.position1?.bullets || output.position1.bullets.length < 4) {
      throw new Error(`Detail Writer output has ${output.position1?.bullets?.length || 0} P1 bullets (expected 4)`);
    }

    // Validate P2
    if (!output.position2?.overview?.content) {
      throw new Error('Detail Writer output missing Position 2 overview');
    }
    if (!output.position2?.bullets || output.position2.bullets.length < 3) {
      throw new Error(`Detail Writer output has ${output.position2?.bullets?.length || 0} P2 bullets (expected 3)`);
    }

    // Check for banned verb usage
    const allBullets = [...output.position1.bullets, ...output.position2.bullets];
    for (const bullet of allBullets) {
      const verbLower = bullet.primaryVerb?.toLowerCase();
      if (verbLower && bannedLower.includes(verbLower)) {
        console.warn(`[${this.name}] WARNING: Used banned verb "${bullet.primaryVerb}" in ${bullet.slot}`);
      }
    }

    // Check for emdashes
    const allText = [
      output.position1.overview.content,
      output.position2.overview.content,
      ...allBullets.map(b => b.content)
    ].join(' ');

    if (allText.includes('—')) {
      console.warn(`[${this.name}] WARNING: Output contains emdashes which should be avoided`);
    }

    // Check verb repetition within P1
    const p1Verbs = output.position1.bullets.map(b => b.primaryVerb?.toLowerCase());
    const p1UniqueVerbs = new Set(p1Verbs);
    if (p1UniqueVerbs.size < p1Verbs.length) {
      console.warn(`[${this.name}] WARNING: Repeated verbs within Position 1`);
    }

    // Check verb repetition within P2
    const p2Verbs = output.position2.bullets.map(b => b.primaryVerb?.toLowerCase());
    const p2UniqueVerbs = new Set(p2Verbs);
    if (p2UniqueVerbs.size < p2Verbs.length) {
      console.warn(`[${this.name}] WARNING: Repeated verbs within Position 2`);
    }

    // Check bullet word counts
    for (const bullet of allBullets) {
      const wordCount = bullet.content?.split(/\s+/).length || 0;
      if (wordCount < 20 || wordCount > 50) {
        console.warn(`[${this.name}] WARNING: ${bullet.slot} has ${wordCount} words (expected 25-40)`);
      }
    }
  }
}
