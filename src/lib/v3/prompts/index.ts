// src/lib/v3/prompts/index.ts
// Export all V3 prompt builders

// JD Analyzer
export {
  buildJDAnalyzerPrompt,
  isValidJDAnalyzerOutput,
  parseJDAnalyzerResponse,
} from './jd-analyzer';

// Summary Chat
export {
  buildSummaryChatPrompt,
  isValidSummaryChatOutput,
  parseSummaryChatResponse,
} from './summary-chat';

// CH Chat
export {
  buildCHChatPrompt,
  isValidCHChatOutput,
  parseCHChatResponse,
} from './ch-chat';

// P1 Chat
export {
  buildP1ChatPrompt,
  isValidP1ChatOutput,
  parseP1ChatResponse,
} from './p1-chat';

// P2 Chat
export {
  buildP2ChatPrompt,
  isValidP2ChatOutput,
  parseP2ChatResponse,
} from './p2-chat';

// P3-P6 Chat
export {
  buildP3P6ChatPrompt,
  isValidP3P6ChatOutput,
  parseP3P6ChatResponse,
} from './p3p6-chat';
