// src/lib/v3/types.ts
// ResumeOS V3 Type Definitions

// ============ Input Types ============

export interface V3Input {
  jobDescription: string;
  profileId: string;
}

// ============ JD Analysis Types ============

export interface JDAnalyzerOutput {
  metadata: JDMetadata;
  sections: JDSection[];
  globalPhraseFrequency: PhraseFrequency[];
  themes: JDTheme[];
  sectionToResumeMapping: SectionMapping[];
  gaps: JDGap[];
}

export interface JDMetadata {
  company: string;
  title: string;
  industry: string;
  level: string;
  location: string | null;
  reportsTo: string | null;
}

export interface JDSection {
  name: string;
  summary: string;
  keyPhrases: KeyPhrase[];
}

export interface KeyPhrase {
  phrase: string;
  weight: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface PhraseFrequency {
  phrase: string;
  count: number;
  sectionsFound: string[];
}

export interface JDTheme {
  theme: string;
  evidence: string[];
  priority: 'Critical' | 'High' | 'Medium' | 'Low';
}

export interface SectionMapping {
  jdSection: string;
  bestAddressedBy: ('Summary' | 'CH' | 'P1' | 'P2' | 'P3-P6')[];
}

export interface JDGap {
  requirement: string;
  riskLevel: 'High' | 'Medium' | 'Low';
  notes: string;
}

// ============ Thematic Anchors ============

export interface ThematicAnchors {
  primaryNarrative: string;
  distinctiveValue: string;
  toneEstablished: string;

  doNotRepeat: {
    metrics: string[];
    clients: string[];
    phrases: string[];
  };

  reinforce: {
    beliefs: string[];
    capabilities: string[];
  };
}

// ============ JD Mapping Entry ============

export interface JDMappingEntry {
  phraseUsed: string;
  jdSection: string;
  jdPhraseSource: string;
  exactQuote: boolean;
}

// ============ Coverage Types ============

export interface SectionCoverage {
  section: string;
  strength: 'Strong' | 'Partial' | 'Gap';
  coveredBy: string[];
}

export interface GapEntry {
  gap: string;
  severity: 'High' | 'Medium' | 'Low' | 'Acknowledged';
  notes: string;
}

// ============ Summary Chat Output ============

export interface SummaryChatOutput {
  positioningDecision: {
    approach: string;
    rationale: string;
  };
  summary: {
    content: string;
    wordCount: number;
    sourcesUsed: string[];
  };
  jdMapping: JDMappingEntry[];
  thematicAnchors: ThematicAnchors;
  stateForDownstream: {
    usedVerbs: string[];
    usedMetrics: string[];
    jdPhrasesUsed: string[];
    jdSectionsAddressed: string[];
  };
}

// ============ CH Chat Output ============

export interface CHEntry {
  slot: string;
  sourceId: string;
  baseId: string;
  headline: string;
  content: string;
  wordCount: number;
  primaryVerb: string;
  jdMapping: JDMappingEntry[];
  selectionRationale: string;
}

export interface CHChatOutput {
  careerHighlights: CHEntry[];
  coverageAnalysis: {
    jdSectionsCovered: SectionCoverage[];
    gapsRemaining: GapEntry[];
  };
  stateForDownstream: {
    usedBaseIds: string[];
    usedVerbs: string[];
    usedMetrics: string[];
    jdSectionsCoveredByCH: string[];
  };
}

// ============ P1 Chat Output ============

export interface OverviewEntry {
  sourceId: string;
  content: string;
  wordCount: number;
  jdMapping: JDMappingEntry[];
}

export interface BulletEntry {
  slot: string;
  sourceId: string;
  baseId: string;
  content: string;
  wordCount: number;
  primaryVerb: string;
  jdMapping: JDMappingEntry[];
  gapAddressed: string;
  selectionRationale: string;
}

export interface P1ChatOutput {
  overview: OverviewEntry;
  bullets: BulletEntry[];
  coverageAnalysis: {
    jdSectionsAddressed: SectionCoverage[];
    gapsRemaining: GapEntry[];
    phrasesCovered: string[];
  };
  stateForDownstream: {
    usedBaseIds: string[];
    usedVerbs: string[];
    usedMetrics: string[];
    jdSectionsCoveredByP1: string[];
  };
}

// ============ P2 Chat Output ============

export interface P2BulletEntry extends BulletEntry {
  patternProof: string;
}

export interface P2ChatOutput {
  overview: OverviewEntry;
  bullets: P2BulletEntry[];
  coverageAnalysis: {
    finalCoverage: SectionCoverage[];
    remainingGaps: GapEntry[];
    unusedHighPhrases: string[];
  };
  stateForDownstream: {
    usedBaseIds: string[];
    usedVerbs: string[];
    allVerbsUsedInResume: string[];
  };
}

// ============ P3-P6 Chat Output ============

export interface P3P6OverviewEntry {
  position: 3 | 4 | 5 | 6;
  sourceId: string;
  content: string;
  wordCount: number;
  startingVerb: string;
  jdRelevance: {
    relevant: boolean;
    connection: string | null;
    phraseUsed: string | null;
  };
}

export interface P3P6ChatOutput {
  overviews: P3P6OverviewEntry[];
  verbsUsed: string[];
  trajectoryNarrative: string;
}

// ============ State Accumulator ============

export interface AccumulatedState {
  // From Summary
  thematicAnchors?: ThematicAnchors;
  summaryVerbs: string[];
  summaryMetrics: string[];
  summaryPhrases: string[];
  summarySectionsAddressed: string[];

  // From CH
  chUsedBaseIds: string[];
  chUsedVerbs: string[];
  chUsedMetrics: string[];
  chCoverage: SectionCoverage[];

  // From P1
  p1UsedBaseIds: string[];
  p1UsedVerbs: string[];
  p1UsedMetrics: string[];
  p1SectionsAddressed: string[];

  // From P2
  p2UsedBaseIds: string[];
  p2UsedVerbs: string[];

  // Computed aggregates
  allUsedBaseIds: string[];
  allUsedVerbs: string[];
  allUsedMetrics: string[];
}

// ============ Diagnostics ============

export interface V3Diagnostics {
  sessionId: string;
  startedAt: string;
  completedAt: string;
  totalDurationMs: number;
  totalCost: number;

  steps: StepDiagnostic[];
  errors: ErrorEntry[];
  warnings: string[];
}

export interface StepDiagnostic {
  step: 'jd-analyzer' | 'summary' | 'ch' | 'p1' | 'p2' | 'p3p6';
  status: 'success' | 'retry' | 'failed';
  durationMs: number;
  inputTokens: number;
  outputTokens: number;
  cost: number;
  retryCount: number;
  validationIssues?: string[];
}

export interface ErrorEntry {
  step: string;
  error: string;
  fatal: boolean;
}

// ============ Orchestrator Result ============

export interface V3Result {
  success: boolean;
  sessionId: string;

  jdAnalysis: JDAnalyzerOutput;
  summary: SummaryChatOutput;
  careerHighlights: CHChatOutput;
  position1: P1ChatOutput;
  position2: P2ChatOutput;
  positions3to6: P3P6ChatOutput;

  finalCoverage: {
    jdSections: SectionCoverage[];
    gaps: GapEntry[];
    unusedHighPhrases: string[];
  };

  diagnostics: V3Diagnostics;
}

// ============ Resume Output ============

export interface ResumeV3 {
  version: '3.0';
  generatedAt: string;
  sessionId: string;
  targetRole: {
    company: string;
    title: string;
    industry: string;
  };

  header: ResumeHeader;
  summary: string;
  careerHighlights: CareerHighlight[];
  positions: Position[];
  education: Education[];

  metadata: ResumeMetadata;
}

export interface ResumeHeader {
  name: string;
  targetTitle: string;
  location: string;
  phone: string;
  email: string;
  linkedin?: string;
}

export interface CareerHighlight {
  headline: string;
  content: string;
  sourceId: string;
}

export interface Position {
  number: 1 | 2 | 3 | 4 | 5 | 6;
  company: string;
  title: string;
  location: string;
  startDate: string;
  endDate: string;
  overview: string;
  bullets?: string[];
}

export interface Education {
  institution: string;
  degree: string;
  field: string;
  year?: string;
}

export interface ResumeMetadata {
  thematicAnchors: ThematicAnchors;
  jdCoverage: {
    sections: SectionCoverage[];
    gaps: GapEntry[];
    unusedHighPhrases: string[];
  };
  contentSources: {
    summary: string[];
    careerHighlights: string[];
    p1Bullets: string[];
    p2Bullets: string[];
    overviews: string[];
  };
  diagnostics: {
    totalCost: number;
    totalDurationMs: number;
    retryCount: number;
  };
}

// ============ Content Source Types ============

export interface SummarySource {
  id: string;
  label: string;
  content: string;
  emphasis: string[];
}

export interface CHSource {
  id: string;
  baseId: string;
  variantLabel?: string;
  content: string;
  tags: {
    industry: string[];
    function: string[];
    theme: string[];
  };
}

export interface BulletSource {
  id: string;
  baseId: string;
  type: 'bullet' | 'overview';
  variantLabel?: string;
  content: string;
  tags: {
    industry: string[];
    function: string[];
    theme: string[];
  };
}

export interface ContentSources {
  summaries: SummarySource[];
  careerHighlights: CHSource[];
  p1Sources: BulletSource[];
  p2Sources: BulletSource[];
  p3p6Overviews: BulletSource[];
}

// ============ Profile Types ============

export interface ProfilePosition {
  company: string;
  title: string;
  startDate: string;
  endDate: string;
  location: string;
}

export interface ProfileHeader {
  name: string;
  targetTitle: string;
  location: string;
  phone: string;
  email: string;
  linkedin?: string;
}

export interface Profile {
  header: ProfileHeader;
  positions: ProfilePosition[];
  education: Education[];
}

// ============ Validation Types ============

export interface ValidationResult {
  valid: boolean;
  issues: string[];
  canRetry: boolean;
}
