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
  frequency?: number;            // How many times it appears in JD
  priority: KeywordPriority;
  placement: string;             // "title, requirements"
  status: KeywordStatus;
  sectionAddressed?: string;     // "summary" | "highlights" | "position_1" etc.
  userContext?: string;          // User-provided context for how it applies
  dismissReason?: string;        // Why user dismissed it
}

// Theme with evidence for tailoring
export interface PositioningTheme {
  theme: string;
  evidence: string;      // Why this theme matters based on JD language
  jd_quotes: string[];   // 2-3 exact phrases from JD supporting this theme
}

export interface JDStrategic {
  targetTitle: string;
  targetCompany: string;
  industry: string;
  positioningThemes: PositioningTheme[];  // Now includes evidence
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

// ============================================
// V1.5 One-Shot Generation Types
// ============================================

// One-shot generated resume structure
export interface GeneratedResume {
  summary: string;
  career_highlights: string[];
  positions: GeneratedPosition[];
  themes_addressed: string[];
  themes_not_addressed: string[];
  verbs_used: string[];
  content_ids_used: string[];
  generated_at: string; // ISO date
}

export interface GeneratedPosition {
  number: 1 | 2 | 3 | 4 | 5 | 6;
  title: string;
  company: string;
  dates: string;
  location: string;
  overview: string;
  bullets?: string[]; // Only P1 (4 bullets) and P2 (3 bullets)
}

// Gap detection
export interface Gap {
  id: string;
  theme: string;
  severity: 'critical' | 'moderate' | 'minor';
  reason: string;
  recommendation?: GapRecommendation;
  status: 'open' | 'addressed' | 'skipped';
}

export interface GapRecommendation {
  affectedSections: string[];
  suggestion: string;
  contentToReframe?: string; // Content ID that could address this
}

// Quality scoring
export interface QualityScore {
  overall: 'A' | 'B' | 'C' | 'D' | 'F';
  keyword_coverage: number; // 0-100
  theme_alignment: number; // 0-100
  issues: QualityIssue[];
}

export interface QualityIssue {
  type: 'bullet_length' | 'verb_repetition' | 'phrase_repetition' | 'jargon';
  severity: 'error' | 'warning';
  location: string; // e.g., "P1-B2", "summary"
  message: string;
  autoFixed?: boolean;
}

// ATS Keyword with frequency tracking
export interface ATSKeyword {
  keyword: string;
  frequency: number; // How many times it appears in JD
  priority: 'high' | 'medium' | 'low'; // high = 2+, medium = 1, low = nice-to-have
  category?: KeywordCategory;
  placement?: string; // Where in JD: "title", "requirements", "responsibilities", "nice-to-have"
}

// Keyword Gap detection
export interface KeywordGap {
  keyword: string;
  frequency_in_jd: number;
  found_in_resume: boolean;
  suggestion?: string; // Suggested sections where it could fit
}

// Enhanced JD Analysis (extends existing)
export interface EnhancedJDAnalysis {
  target_title: string;
  target_company: string;
  priority_themes: JDTheme[];
  secondary_themes: JDTheme[];
  ats_keywords: ATSKeyword[]; // Changed from string[] to ATSKeyword[]
  content_mapping: ContentMapping[]; // Which content items map to which themes
}

export interface JDTheme {
  theme: string;
  importance: 'must_have' | 'nice_to_have';
  jd_evidence: string; // Quote from JD that shows this
}

export interface ContentMapping {
  theme: string;
  content_ids: string[];
  reframe_suggestion?: string;
}

// ============================================
// Chat Refinement Types
// ============================================

export interface RefinementMessage {
  id: string;
  section: string;       // "summary", "highlight_1", "position_1_overview", etc.
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;     // ISO date string
}
