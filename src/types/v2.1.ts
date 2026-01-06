// ============================================================
// ResumeOS V2.1: Two-Phase Writer Types
// ============================================================

import { JDStrategy, GapAnalysis, UserAdjustments } from './v2';

// Re-export V2 types that we still use
export type { JDStrategy, GapAnalysis, UserAdjustments };

// ============================================================
// CONTENT SELECTION INPUT TYPES (for Allocator)
// These represent the "candidates per slot" format from selector
// ============================================================

/**
 * A candidate content item that can be assigned to a slot
 */
export interface ContentCandidate {
  id: string;           // "CH-05-V2", "P1-B08-V1"
  content: string;      // The actual source text
  score: number;        // Relevance score from selector
  matchedTags: string[]; // Tags that matched this item
}

/**
 * Content selection result formatted for the allocator
 * Each slot has an array of candidates sorted by score (highest first)
 */
export interface AllocatorInput {
  summaries: ContentCandidate[];                    // Summary sources (separate pool)
  careerHighlights: ContentCandidate[][];           // 5 slots, each with ranked candidates
  position1Bullets: ContentCandidate[][];           // 4 slots, each with ranked candidates
  position2Bullets: ContentCandidate[][];           // 3 slots, each with ranked candidates
  overviews: {
    [position: number]: ContentCandidate[];         // Position number -> overview candidates
  };
}

// ============================================================
// CONTENT ALLOCATION TYPES
// ============================================================

export interface AllocatedSlot {
  slot: string;           // "ch-1", "p1-bullet-2", etc.
  contentId: string;      // "CH-05-V2", "P1-B08-V1"
  content: string;        // The actual source text
  score: number;          // Relevance score from selector
}

export interface ContentAllocation {
  summaries: AllocatedSlot[];
  careerHighlights: AllocatedSlot[];
  position1Bullets: AllocatedSlot[];
  position2Bullets: AllocatedSlot[];
  position1Overview: AllocatedSlot | null;
  position2Overview: AllocatedSlot | null;
  allocationLog: AllocationLogEntry[];
}

export interface AllocationLogEntry {
  action: 'assigned' | 'skipped' | 'blocked';
  slot: string;
  contentId: string | null;
  reason: string;
  blockedVariants?: string[];
}

// ============================================================
// PHASE 1: NARRATIVE WRITER TYPES
// ============================================================

export interface NarrativeWriterInput {
  strategy: JDStrategy;
  allocation: ContentAllocation;
}

export interface NarrativeWriterOutput {
  summary: {
    content: string;
    wordCount: number;
    sourcesUsed: string[];
  };
  careerHighlights: {
    slot: string;
    headline: string;
    content: string;
    sourceId: string;
    primaryVerb: string;
  }[];
  metadata: {
    usedVerbs: string[];
    thematicAnchors: ThematicAnchors;
  };
}

export interface ThematicAnchors {
  primaryNarrative: string;
  distinctiveValue: string;
  keyProofPoints: string[];
  toneEstablished: string;
}

// ============================================================
// PHASE 2: DETAIL WRITER TYPES
// ============================================================

export interface DetailWriterInput {
  strategy: JDStrategy;
  allocation: ContentAllocation;
  phase1Output: NarrativeWriterOutput;
}

export interface DetailWriterOutput {
  position1: PositionContent;
  position2: PositionContent;
  metadata: {
    usedVerbs: string[];
  };
}

export interface PositionContent {
  overview: {
    content: string;
    sourceId: string;
    wordCount: number;
  };
  bullets: {
    slot: string;
    content: string;
    sourceId: string;
    primaryVerb: string;
    wordCount: number;
  }[];
}

// ============================================================
// ASSEMBLED RESUME TYPES
// ============================================================

export interface AssembledResume {
  header: ResumeHeader;
  summary: string;
  careerHighlights: string[];
  positions: ResumePosition[];
  education: ResumeEducation;
  _meta: ResumeMeta;
}

export interface ResumeHeader {
  name: string;
  targetTitle: string;
  location: string;
  phone: string;
  email: string;
}

export interface ResumePosition {
  company: string;
  title: string;
  location: string;
  startDate: string;
  endDate: string;
  overview: string;
  bullets: string[];
}

export interface ResumeEducation {
  school: string;
  degree: string;
  field: string;
}

export interface ResumeMeta {
  assembledAt: string;
  sourcesUsed: {
    summary: string[];
    careerHighlights: string[];
    position1: string[];
    position2: string[];
  };
}

// ============================================================
// ENHANCED VALIDATION TYPES
// ============================================================

export interface FormatChecks {
  emdashDetected: {
    passed: boolean;
    locations: string[];
  };
  wordVariety: {
    passed: boolean;
    overusedWords: { word: string; count: number; locations: string[] }[];
  };
  summaryLength: {
    wordCount: number;
    passed: boolean;
  };
  bulletLengths: {
    passed: boolean;
    issues: { location: string; wordCount: number; expected: string }[];
  };
  verbRepetition: {
    passed: boolean;
    issues: { verb: string; positions: string[] }[];
  };
}

export interface ValidationResultV21 {
  overallVerdict: 'pass' | 'pass-with-warnings' | 'fail';
  honestyScore: number;
  coverageScore: number;
  qualityScore: number;
  formatChecks: FormatChecks;
  issues: ValidationIssueV21[];
  metricsVerification: MetricVerificationV21[];
  requirementsCoverage: RequirementCoverageV21[];
}

export interface ValidationIssueV21 {
  category: 'honesty' | 'attribution' | 'coverage' | 'quality' | 'positioning' | 'format';
  severity: 'blocker' | 'warning' | 'suggestion';
  location: string;
  issue: string;
  evidence: string;
  suggestedFix: string;
}

export interface MetricVerificationV21 {
  metric: string;
  location: string;
  sourceId: string;
  sourceValue: string;
  match: boolean;
  issue?: string;
}

export interface RequirementCoverageV21 {
  requirement: string;
  priority: string;
  covered: boolean;
  location: string;
  strength: 'strong' | 'adequate' | 'weak' | 'missing';
}

// ============================================================
// PIPELINE SESSION TYPES (V2.1)
// ============================================================

export type PipelineStateV21 =
  | 'analyzing'
  | 'selecting'
  | 'allocating'
  | 'gap-review'
  | 'approved'
  | 'writing-narrative'
  | 'writing-detail'
  | 'validating'
  | 'complete'
  | 'failed';

export interface PipelineSessionV21 {
  id: string;
  status: PipelineStateV21;
  profileId: string;
  jobDescription: string;
  targetTitle?: string;
  createdAt: string;

  // Analysis phase
  jdStrategy: JDStrategy | null;
  contentSelection: AllocatorInput | null;
  gapAnalysis: GapAnalysis | null;

  // Allocation phase
  contentAllocation: ContentAllocation | null;

  // User intervention
  userAdjustments: UserAdjustments | null;

  // Writing phases
  narrativeOutput: NarrativeWriterOutput | null;
  detailOutput: DetailWriterOutput | null;

  // Final output
  assembledResume: AssembledResume | null;
  validation: ValidationResultV21 | null;
}
