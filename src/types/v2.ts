// ============================================
// ResumeOS V2: Multi-Agent Pipeline Types
// ============================================

// ============================================
// Agent 1: JD Strategist Types
// ============================================

export interface JDStrategistInput {
  jobDescription: string;
  companyName?: string;
  targetTitle?: string;
}

export interface JDStrategy {
  // Company Context
  company: {
    name: string;
    industry: string;
    subIndustry?: string;
    industryKeywords: string[];
    competitors?: string[];
    cultureSignals: string[];
    companySpecificLanguage: string[];
  };

  // Role Analysis
  role: {
    title: string;
    level: 'executive' | 'senior' | 'mid' | 'junior';
    function: string;
    functionKeywords: string[];
    scope: string;
    reportsTo?: string;
    keyStakeholders: string[];
  };

  // Requirements
  requirements: {
    mustHave: Requirement[];
    niceToHave: Requirement[];
  };

  // Positioning Strategy
  positioning: {
    primaryAngle: PositioningAngle;
    supportingAngles: PositioningAngle[];
    narrativeDirection: string;
  };

  // Language Guidance
  language: {
    termsToMirror: LanguageMapping[];
    termsToAvoid: string[];
    toneGuidance: string;
  };

  // Scoring Signals
  scoringSignals: {
    industries: string[];
    functions: string[];
    themes: string[];
  };
}

export interface Requirement {
  requirement: string;
  category: 'experience' | 'skill' | 'leadership' | 'industry' | 'outcome';
  priority: 'critical' | 'important' | 'preferred';
  jdEvidence: string;
}

export interface PositioningAngle {
  angle: string;
  jdEvidence: string;
  contentImplication: string;
}

export interface LanguageMapping {
  jdTerm: string;
  naturalUsage: string;
  context: string;
}

// ============================================
// Content Selection Types
// ============================================

export interface SourceItem {
  id: string;
  baseId: string;
  variantLabel?: string;
  content: string;
  score: number;
  tags: {
    industry: string[];
    function: string[];
    theme: string[];
  };
}

export interface SlotSelection {
  slot: string;
  sources: SourceItem[];
  selectionRationale: string;
}

export interface ScoreBreakdown {
  itemId: string;
  baseId?: string;
  industryScore: number;
  functionScore: number;
  themeScore: number;
  totalScore: number;
  matchedTags: {
    industry: string[];
    function: string[];
    theme: string[];
  };
}

export interface ContentSelectionResult {
  summary: SlotSelection;
  careerHighlights: SlotSelection[];
  position1: {
    overview: SlotSelection;
    bullets: SlotSelection[];
  };
  position2: {
    overview: SlotSelection;
    bullets: SlotSelection[];
  };
  positions3to6: {
    position: 3 | 4 | 5 | 6;
    overview: SlotSelection;
  }[];
  debug: {
    jdSignals: {
      industries: string[];
      functions: string[];
      themes: string[];
    };
    scoringBreakdown: ScoreBreakdown[];
    conflictsApplied: string[];
  };
}

// Alias for backward compatibility with implementation plan
export type SourceSelection = ContentSelectionResult;
export type SelectedSource = SourceItem;

// ============================================
// Agent 2: Gap Analyzer Types
// ============================================

export type GapType =
  | 'not_covered'
  | 'partially_covered'
  | 'weak_coverage'
  | 'positioning_unsupported'
  | 'missing_critical'
  | 'language_gap';

export interface RequirementCoverage {
  requirement: Requirement;
  coverage: 'fully_covered' | 'partially_covered' | 'not_covered';
  coveringSource: string | null;
  gap: string | null;
  suggestion: string | null;
}

export interface EmphasisRecommendation {
  slotId: string;
  sourceId: string;
  recommendation: string;
  reason: string;
}

export interface HonestGap {
  requirement: string;
  reason: string;
  mitigation: string | null;
}

export interface PositioningAlignment {
  primaryAngleSupported: boolean;
  supportingAnglesCovered: string[];
  missingAngles: string[];
  narrativeViability: string;
}

export interface GapWarning {
  type: 'missing_critical' | 'weak_coverage' | 'positioning_mismatch';
  message: string;
  severity: 'blocker' | 'warning' | 'info';
}

export interface GapAnalysis {
  overallCoverage: {
    score: number;
    assessment: 'strong' | 'adequate' | 'weak' | 'poor';
    summary: string;
  };
  requirementCoverage: RequirementCoverage[];
  emphasisRecommendations: EmphasisRecommendation[];
  honestGaps: HonestGap[];
  positioningAlignment: PositioningAlignment;
  warnings: GapWarning[];
}

// ============================================
// User Intervention Types
// ============================================

export interface SlotContext {
  slotId: string;
  additionalContext: string;
  emphasize: string[];
  deEmphasize: string[];
}

export interface UserAdjustments {
  slotContext: SlotContext[];
  globalInstructions: string;
  acknowledgedGaps: string[];
}

// ============================================
// Agent 3: Resume Writer Types
// ============================================

export interface WrittenSection {
  content: string;
  sourcesUsed: string[];
}

export interface WrittenCareerHighlight {
  slotId: string;
  content: string;
  sourcesUsed: string[];
}

export interface WrittenPosition {
  position: 1 | 2 | 3 | 4 | 5 | 6;
  company: string;
  title: string;
  dates: string;
  location: string;
  overview: WrittenSection;
  bullets?: WrittenSection[];
}

export interface MetricUsage {
  metric: string;
  sourceId: string;
  usedIn: string;
}

export interface WritingMetadata {
  metricsUsed: MetricUsage[];
  clientsReferenced: string[];
  positioningAngleServed: string;
}

export interface WriterOutput {
  summary: WrittenSection;
  careerHighlights: WrittenCareerHighlight[];
  positions: WrittenPosition[];
  writingMetadata: WritingMetadata;
}

// Alias for backward compatibility
export type WrittenResume = WriterOutput;
export type ResumeContent = WriterOutput;

// ============================================
// Agent 4: Validator Types
// ============================================

export interface HonestyIssue {
  location: string;
  claim: string;
  issue: 'metric_not_in_source' | 'client_not_in_source' | 'outcome_fabricated';
  severity: 'blocker' | 'warning';
}

export interface MetricVerification {
  metric: string;
  sourceId: string;
  verified: boolean;
}

export interface HonestyValidation {
  score: number;
  passed: boolean;
  issues: HonestyIssue[];
  metricsVerified: MetricVerification[];
}

export interface RequirementAddressed {
  requirement: string;
  addressed: boolean;
  where: string | null;
}

export interface CoverageValidation {
  score: number;
  passed: boolean;
  requirementsAddressed: RequirementAddressed[];
  positioningServed: boolean;
}

export type QualityIssueType =
  | 'verb_repetition'
  | 'bullet_too_long'
  | 'bullet_too_short'
  | 'passive_voice'
  | 'weak_verb'
  | 'missing_quantification';

export interface QualityIssueV2 {
  type: QualityIssueType;
  location: string;
  detail: string;
  severity: 'blocker' | 'warning' | 'suggestion';
}

export interface VerbUsage {
  verb: string;
  count: number;
  locations: string[];
}

export interface QualityValidation {
  score: number;
  passed: boolean;
  issues: QualityIssueV2[];
  verbUsage: VerbUsage[];
}

export interface SuggestedFix {
  location: string;
  issue: string;
  suggestion: string;
  autoFixable: boolean;
}

export interface ValidationResult {
  passed: boolean;
  overallScore: number;
  honesty: HonestyValidation;
  coverage: CoverageValidation;
  quality: QualityValidation;
  suggestedFixes: SuggestedFix[];
}

// Alias for backward compatibility
export type ValidationReport = ValidationResult;
export type ValidationIssue = HonestyIssue | QualityIssueV2;

// ============================================
// Pipeline Session Types
// ============================================

export type PipelineState =
  | 'analyzing'
  | 'selecting'
  | 'gap-review'
  | 'approved'
  | 'generating'
  | 'validating'
  | 'complete'
  | 'failed';

export interface PipelineSession {
  id: string;
  state: PipelineState;
  createdAt: string;
  updatedAt: string;

  // Input
  jobDescription: string;
  companyName?: string;
  targetTitle?: string;

  // Agent outputs (populated as pipeline progresses)
  jdStrategy?: JDStrategy;
  sourceSelection?: ContentSelectionResult;
  gapAnalysis?: GapAnalysis;
  userAdjustments?: UserAdjustments;
  writerOutput?: WriterOutput;
  validationResult?: ValidationResult;

  // Error tracking
  error?: {
    stage: PipelineState;
    message: string;
    timestamp: string;
  };
}

// ============================================
// Diagnostics Types
// ============================================

export interface AgentDiagnostics {
  agentName: string;
  promptSent: string;
  rawResponse: string;
  parsedOutput: unknown;
  inputTokens: number;
  outputTokens: number;
  cost: number;
  durationMs: number;
  timestamp: string;
}

export interface ContentSelectionDiagnostics {
  signals: {
    industries: string[];
    functions: string[];
    themes: string[];
  };
  allScores: ScoreBreakdown[];
  selectedItems: {
    slotId: string;
    sourceIds: string[];
  }[];
  conflictsApplied: string[];
  durationMs: number;
}

export interface UserInterventionDiagnostics {
  adjustmentsMade: UserAdjustments;
  timeToApproveMs: number;
}

export interface PipelineDiagnostics {
  sessionId: string;
  pipelineVersion: 'v2';

  timing: {
    totalDurationMs: number;
    agentTimings: {
      agent: 'jd_strategist' | 'gap_analyzer' | 'resume_writer' | 'validator';
      durationMs: number;
      tokens: { prompt: number; completion: number };
    }[];
    contentSelectionMs: number;
  };

  costs: {
    totalUSD: number;
    byAgent: {
      agent: string;
      costUSD: number;
    }[];
  };

  agents: {
    jdStrategist?: AgentDiagnostics;
    gapAnalyzer?: AgentDiagnostics;
    resumeWriter?: AgentDiagnostics;
    validator?: AgentDiagnostics;
  };

  contentSelection?: ContentSelectionDiagnostics;
  userIntervention?: UserInterventionDiagnostics;
}

// ============================================
// Agent Input Types (for clarity)
// ============================================

export interface GapAnalyzerInput {
  jdStrategy: JDStrategy;
  sourceSelection: ContentSelectionResult;
}

export interface ResumeWriterInput {
  jdStrategy: JDStrategy;
  sourceSelection: ContentSelectionResult;
  gapAnalysis: GapAnalysis;
  userAdjustments: UserAdjustments;
}

export interface ValidatorInput {
  sourceSelection: ContentSelectionResult;
  writtenResume: WriterOutput;
  jdStrategy: JDStrategy;
}
