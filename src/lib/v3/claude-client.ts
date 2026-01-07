// src/lib/v3/claude-client.ts
// Claude API wrapper for V3 pipeline

import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();

// Default model for V3 pipeline
export const V3_MODEL = 'claude-sonnet-4-20250514';

export interface ClaudeRequest {
  model?: string;
  messages: { role: 'user' | 'assistant'; content: string }[];
  maxTokens: number;
  temperature?: number;
}

export interface ClaudeResponse {
  content: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
}

export async function callClaude(request: ClaudeRequest): Promise<ClaudeResponse> {
  const response = await client.messages.create({
    model: request.model || V3_MODEL,
    max_tokens: request.maxTokens,
    temperature: request.temperature ?? 0.3,
    messages: request.messages,
  });

  const textBlock = response.content.find((b) => b.type === 'text');

  return {
    content: textBlock?.text || '',
    usage: {
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    },
  };
}

// Calculate cost based on Opus 4.5 pricing
// Opus 4.5: $15/1M input, $75/1M output
export function calculateCost(usage: { inputTokens: number; outputTokens: number }): number {
  const inputCost = (usage.inputTokens / 1_000_000) * 15;
  const outputCost = (usage.outputTokens / 1_000_000) * 75;
  return inputCost + outputCost;
}

// Parse JSON from Claude response, handling markdown code blocks
export function parseJsonResponse<T>(content: string): T {
  const cleaned = content
    .replace(/```json\n?/g, '')
    .replace(/```\n?/g, '')
    .trim();

  return JSON.parse(cleaned) as T;
}
