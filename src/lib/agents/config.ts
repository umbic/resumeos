// ============================================
// ResumeOS V2: Agent Configuration
// ============================================

export const AGENT_CONFIG = {
  model: 'claude-opus-4-20250514',
  maxTokens: {
    jdStrategist: 4000,
    gapAnalyzer: 4000,
    resumeWriter: 8000,
    validator: 4000,
  },
  timeouts: {
    jdStrategist: 60000,
    gapAnalyzer: 60000,
    resumeWriter: 120000,
    validator: 60000,
  },
  // Claude Opus pricing as of January 2025
  pricing: {
    inputPerMillion: 15,
    outputPerMillion: 75,
  },
} as const;

export type AgentName = 'jdStrategist' | 'gapAnalyzer' | 'resumeWriter' | 'validator';

/**
 * Calculate the cost for an API call based on token usage
 * @param inputTokens - Number of input tokens
 * @param outputTokens - Number of output tokens
 * @returns Cost in USD
 */
export function calculateCost(inputTokens: number, outputTokens: number): number {
  return (
    (inputTokens * AGENT_CONFIG.pricing.inputPerMillion) / 1_000_000 +
    (outputTokens * AGENT_CONFIG.pricing.outputPerMillion) / 1_000_000
  );
}

/**
 * Get max tokens for a specific agent
 */
export function getMaxTokens(agentName: AgentName): number {
  return AGENT_CONFIG.maxTokens[agentName];
}

/**
 * Get timeout for a specific agent
 */
export function getTimeout(agentName: AgentName): number {
  return AGENT_CONFIG.timeouts[agentName];
}
