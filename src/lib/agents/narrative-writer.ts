import Anthropic from '@anthropic-ai/sdk';
import { AGENT_CONFIG, calculateCost } from './config';
import { JDStrategy } from '@/types/v2';
import { ContentAllocation, NarrativeWriterOutput } from '@/types/v2.1';
import { buildNarrativeWriterPrompt } from '../prompts/narrative-writer-prompt';

export interface NarrativeWriterInput {
  strategy: JDStrategy;
  allocation: ContentAllocation;
}

export interface NarrativeWriterDiagnostics {
  promptSent: string;
  rawResponse: string;
  inputTokens: number;
  outputTokens: number;
  cost: number;
  durationMs: number;
}

export interface NarrativeWriterResult {
  output: NarrativeWriterOutput;
  diagnostics: NarrativeWriterDiagnostics;
}

export class NarrativeWriterAgent {
  private client: Anthropic;
  private name = 'Narrative Writer';

  constructor() {
    this.client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }

  async run(input: NarrativeWriterInput): Promise<NarrativeWriterResult> {
    const startTime = Date.now();
    const prompt = buildNarrativeWriterPrompt(input.strategy, input.allocation);

    console.log(`[${this.name}] Starting...`);

    const response = await this.client.messages.create({
      model: AGENT_CONFIG.model,
      max_tokens: 3000, // Specific to narrative writer
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
    this.validateOutput(output);

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

  private parseResponse(response: string): NarrativeWriterOutput {
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
      return JSON.parse(cleaned) as NarrativeWriterOutput;
    } catch (error) {
      // Try to extract JSON object if there's other text around it
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          return JSON.parse(jsonMatch[0]) as NarrativeWriterOutput;
        } catch {
          // Fall through to throw original error
        }
      }
      console.error(`[${this.name}] Failed to parse response:`, cleaned.substring(0, 500));
      throw new Error(`Failed to parse ${this.name} response as JSON: ${error}`);
    }
  }

  private validateOutput(output: NarrativeWriterOutput): void {
    // Validate summary
    if (!output.summary?.content) {
      throw new Error('Narrative Writer output missing summary content');
    }

    const summaryWords = output.summary.content.split(/\s+/).length;
    if (summaryWords < 120 || summaryWords > 180) {
      console.warn(`[${this.name}] Summary word count outside range: ${summaryWords} (expected 140-160)`);
    }

    // Validate career highlights
    if (!output.careerHighlights || output.careerHighlights.length < 5) {
      throw new Error(`Narrative Writer output has ${output.careerHighlights?.length || 0} career highlights (expected 5)`);
    }

    // Check for emdashes
    const allText = output.summary.content + output.careerHighlights.map(ch => ch.content).join(' ');
    if (allText.includes('—')) {
      console.warn(`[${this.name}] WARNING: Output contains emdashes which should be avoided`);
    }

    // Check for verb repetition
    const verbs = output.careerHighlights.map(ch => ch.primaryVerb?.toLowerCase());
    const uniqueVerbs = new Set(verbs);
    if (uniqueVerbs.size < verbs.length) {
      console.warn(`[${this.name}] WARNING: Repeated verbs in career highlights`);
    }

    // Validate metadata
    if (!output.metadata?.usedVerbs || !output.metadata?.thematicAnchors) {
      throw new Error('Narrative Writer output missing metadata');
    }
  }
}
