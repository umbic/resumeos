// ============================================
// ResumeOS V2: Base Agent Class
// ============================================

import Anthropic from '@anthropic-ai/sdk';
import { AGENT_CONFIG, calculateCost, AgentName, getMaxTokens } from './config';
import type { AgentDiagnostics } from '@/types/v2';

/**
 * Abstract base class for all V2 agents.
 * Provides common functionality for API calls, JSON parsing, and diagnostics.
 *
 * @template TInput - The input type for this agent
 * @template TOutput - The output type for this agent
 */
export abstract class BaseAgent<TInput, TOutput> {
  protected client: Anthropic;
  protected agentName: AgentName;

  constructor(agentName: AgentName) {
    this.client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
    this.agentName = agentName;
  }

  /**
   * Build the prompt for this agent. Must be implemented by subclasses.
   */
  abstract buildPrompt(input: TInput): string;

  /**
   * Parse the raw response from Claude. Must be implemented by subclasses.
   */
  abstract parseResponse(response: string): TOutput;

  /**
   * Get the max tokens for this agent. Override in subclasses if needed.
   */
  protected getMaxTokens(): number {
    return getMaxTokens(this.agentName);
  }

  /**
   * Run the agent with the given input.
   * Returns both the parsed output and diagnostics for tracking.
   */
  async run(input: TInput): Promise<{ output: TOutput; diagnostics: AgentDiagnostics }> {
    const prompt = this.buildPrompt(input);
    const startTime = Date.now();

    const message = await this.client.messages.create({
      model: AGENT_CONFIG.model,
      max_tokens: this.getMaxTokens(),
      messages: [{ role: 'user', content: prompt }],
    });

    const endTime = Date.now();
    const rawResponse =
      message.content[0].type === 'text' ? message.content[0].text : '';

    const diagnostics: AgentDiagnostics = {
      agentName: this.agentName,
      promptSent: prompt,
      rawResponse,
      parsedOutput: null, // Set after parsing
      inputTokens: message.usage.input_tokens,
      outputTokens: message.usage.output_tokens,
      cost: calculateCost(message.usage.input_tokens, message.usage.output_tokens),
      durationMs: endTime - startTime,
      timestamp: new Date().toISOString(),
    };

    const output = this.parseResponse(rawResponse);
    diagnostics.parsedOutput = output;

    return { output, diagnostics };
  }

  /**
   * JSON parsing helper that handles markdown code blocks.
   * Claude often wraps JSON responses in ```json ... ``` blocks.
   */
  protected parseJSON<T>(text: string): T {
    let cleaned = text.trim();

    // Remove markdown code fences
    if (cleaned.startsWith('```json')) {
      cleaned = cleaned.slice(7);
    } else if (cleaned.startsWith('```')) {
      cleaned = cleaned.slice(3);
    }

    if (cleaned.endsWith('```')) {
      cleaned = cleaned.slice(0, -3);
    }

    // Trim again after removing fences
    cleaned = cleaned.trim();

    // Try to parse directly
    try {
      return JSON.parse(cleaned) as T;
    } catch (firstError) {
      // Try to extract JSON object if there's other text around it
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          return JSON.parse(jsonMatch[0]) as T;
        } catch {
          // Fall through to throw original error
        }
      }

      throw firstError;
    }
  }

  /**
   * Safely extract a string value from the response.
   * Returns empty string if not found.
   */
  protected extractString(obj: unknown, key: string): string {
    if (obj && typeof obj === 'object' && key in obj) {
      const value = (obj as Record<string, unknown>)[key];
      return typeof value === 'string' ? value : '';
    }
    return '';
  }

  /**
   * Safely extract an array value from the response.
   * Returns empty array if not found.
   */
  protected extractArray<T>(obj: unknown, key: string): T[] {
    if (obj && typeof obj === 'object' && key in obj) {
      const value = (obj as Record<string, unknown>)[key];
      return Array.isArray(value) ? (value as T[]) : [];
    }
    return [];
  }
}
