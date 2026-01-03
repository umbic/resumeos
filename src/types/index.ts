// JD Keyword Types for ATS Analysis

export type KeywordStatus =
  | "unaddressed"      // Not yet included anywhere
  | "addressed"        // Included in approved content
  | "skipped"          // User said "not relevant to this section" — ask again later
  | "dismissed";       // User said "I don't have this" — stop asking

export type KeywordCategory =
  | "hard_skill"
  | "soft_skill"
  | "industry_term"
  | "seniority_signal";

export type KeywordPriority = "high" | "medium" | "low";

export interface JDKeyword {
  id: string;                    // Auto-generated UUID (kw_xxx)
  keyword: string;               // "brand strategy"
  category: KeywordCategory;
  priority: KeywordPriority;
  placement: string;             // "title, requirements"
  status: KeywordStatus;
  sectionAddressed?: string;     // "summary" | "highlights" | "position_1" etc.
  userContext?: string;          // User-provided context for how it applies
  dismissReason?: string;        // Why user dismissed it
}

export interface JDStrategic {
  targetTitle: string;
  targetCompany: string;
  industry: string;
  positioningThemes: string[];
}

export interface JDAnalysis {
  strategic: JDStrategic;
  keywords: JDKeyword[];
}

// Verb Tracking for action verb variety
export interface VerbTracker {
  usedVerbs: Record<string, string[]>; // verb → array of sections where used
  availableVerbs: string[];
}

// Note: Message, ContentOption, HeaderData, PositionData types are defined in lib/store.ts
// Import them directly from there to avoid circular dependencies
