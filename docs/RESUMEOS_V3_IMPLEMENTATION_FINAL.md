# ResumeOS V3: Complete Implementation Specification

> **Version:** 3.0  
> **Status:** Design complete, ready for implementation (MERGED FINAL)  
> **Date:** January 7, 2026  
> **Estimated LOC:** ~2,100

> **Note:** This version includes all fixes from V3_IMPLEMENTATION_FIXES.md
---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Architecture Overview](#architecture-overview)
3. [Why V3 vs V2.1](#why-v3-vs-v21)
4. [TypeScript Types](#typescript-types)
5. [JD Analyzer Prompt](#jd-analyzer-prompt)
6. [Summary Chat Prompt](#summary-chat-prompt)
7. [Career Highlights Chat Prompt](#career-highlights-chat-prompt)
8. [P1 Chat Prompt](#p1-chat-prompt)
9. [P2 Chat Prompt](#p2-chat-prompt)
10. [P3-P6 Chat Prompt](#p3-p6-chat-prompt)
11. [Orchestrator](#orchestrator)
12. [Validators](#validators)
13. [Assembler](#assembler)
14. [DOCX Generator](#docx-generator)
15. [Coverage Report](#coverage-report)
16. [File Structure](#file-structure)
17. [Implementation Sessions](#implementation-sessions)

---

## Executive Summary

V3 is a fundamental redesign of ResumeOS based on a key insight: **quality output comes from focused conversations about ONE thing at a time, with the right context scoped to that task.**

V2.1 produces working resumes but output is generic because it treats the JD as a bag of abstract tags. V3 treats the JD as a structured document with sections that need explicit coverage.

### Core Innovation

Each resume section gets its own "chat" with:
- **Scoped content sources** (only what's relevant)
- **Full JD analysis** (phrase-level, not tags)
- **Section-specific instructions**
- **State from previous chats** (to prevent duplication)

### Constraints

- **Cost:** Does not matter
- **Latency:** Does not matter
- **Quality:** Only thing that matters

---

## Architecture Overview

```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚                        Orchestrator                              â”‚
â”‚                                                                  â”‚
â”‚  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”    â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”    â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”    â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”  â”‚
â”‚  â”‚    JD    â”‚â”€â”€â”€â–¶â”‚ Summary  â”‚â”€â”€â”€â–¶â”‚    CH    â”‚â”€â”€â”€â–¶â”‚    P1    â”‚  â”‚
â”‚  â”‚ Analyzer â”‚    â”‚   Chat   â”‚    â”‚   Chat   â”‚    â”‚   Chat   â”‚  â”‚
â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜    â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜    â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜    â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜  â”‚
â”‚                                                        â”‚        â”‚
â”‚                                         â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜        â”‚
â”‚                                         â–¼                       â”‚
â”‚                                  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”    â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”  â”‚
â”‚                                  â”‚    P2    â”‚â”€â”€â”€â–¶â”‚  P3-P6   â”‚  â”‚
â”‚                                  â”‚   Chat   â”‚    â”‚   Chat   â”‚  â”‚
â”‚                                  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜    â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜  â”‚
â”‚                                                        â”‚        â”‚
â”‚                                         â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜        â”‚
â”‚                                         â–¼                       â”‚
â”‚                                  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”                   â”‚
â”‚                                  â”‚Assembler â”‚                   â”‚
â”‚                                  â”‚  (code)  â”‚                   â”‚
â”‚                                  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜                   â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

### Data Flow

| Order | Chat | Receives | Produces |
|-------|------|----------|----------|
| 1 | **JD Analyzer** | Raw JD text | Sections, phrases, themes, gaps |
| 2 | **Summary** | JD Analysis, Summary sources | Anchors + used state |
| 3 | **CH** | JD, CH sources, Summary anchors | 5 CHs + coverage map + state |
| 4 | **P1** | JD, P1 sources, Summary+CH state | Overview + 4 bullets + state |
| 5 | **P2** | JD, P2 sources, all prior state | Overview + 3 bullets + final coverage |
| 6 | **P3-P6** | JD, P3-P6 overviews, all verbs | 4 overviews |
| 7 | **Assembler** | All outputs + Profile DB | Final resume JSON + DOCX |

### State Passed Between Chats

| From | To | What's Passed |
|------|-----|---------------|
| Summary Chat | All others | `thematicAnchors`, `usedVerbs`, `usedMetrics` |
| CH Chat | P1, P2 | `usedBaseIds`, `usedVerbs`, `usedMetrics`, `jdSectionsCovered` |
| P1 Chat | P2 | `usedBaseIds`, `usedMetrics`, `usedVerbs` |
| P2 Chat | P3-P6 | `allUsedVerbs` |

---

## Why V3 vs V2.1

### What I Did Manually vs What V2.1 Does

| Step | Manual (Quality) | V2.1 (Generic) |
|------|------------------|----------------|
| 1. JD Parsing | Broke JD into sections, extracted *specific phrases* | Extracts abstract tags (industry, function, theme) |
| 2. Selection | Chose CHs based on *which JD sections* they address | Scores on tag overlap only |
| 3. Rewriting | Deliberately wove *specific JD phrases* into rewrites | "Use JD language" (vague instruction) |
| 4. Mapping | Showed *which keyword* addresses *which section* | No mapping exists |
| 5. Gap Analysis | Identified what the CHs *don't* cover | Gap Analyzer exists but coarse |

### V2.1 vs V3 Philosophy

| V2.1 Approach | V3 Approach |
|---------------|-------------|
| Sequential pipeline steps | Independent, rich conversations |
| Each step executes a narrow task | Each chat reasons through the problem |
| Quality through validation passes | Quality through depth |
| "Global Consistency Pass" needed | Each chat is smart enough it doesn't need cleanup |

---

## TypeScript Types

```typescript
// src/lib/v3/types.ts

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
```

---

## JD Analyzer Prompt

```typescript
// src/lib/v3/prompts/jd-analyzer.ts

export function buildJDAnalyzerPrompt(
  jdText: string,
  previousIssues?: string[]
): string {
  
  const retryBlock = previousIssues ? `
## âš ï¸ RETRY REQUIRED

Your previous attempt had these issues:
${previousIssues.map(i => `- ${i}`).join('\n')}

Fix these issues in this attempt.

---
` : '';

  return `You are an expert resume strategist analyzing a job description to identify exactly what a resume needs to demonstrate.

${retryBlock}

## YOUR TASK

Analyze this job description with surgical precision. Your analysis will be used to write a tailored resume, so extract the exact language and phrases the resume should echo.

---

## JOB DESCRIPTION

${jdText}

---

## ANALYSIS INSTRUCTIONS

### STAGE 1: METADATA

Extract basic information:
- Company name (if stated, otherwise "Unknown")
- Job title (exact title from JD)
- Industry (be specific: "Fintech / Consumer Finance" not just "Finance")
- Level (Junior/Mid/Senior/Director/VP/C-Suite, based on years + scope)
- Location (if stated)
- Reports to (if stated)

### STAGE 2: SECTIONS

Break the JD into its natural sections. Most JDs have:
- Overview/Summary (usually first paragraph)
- Responsibilities (often "What You'll Do" with subsections)
- Requirements/Qualifications (often "What We're Looking For")

For EACH section:
1. Give it a clear name
2. Write a 1-2 sentence summary of what it's asking for
3. Extract 5-10 KEY PHRASES that capture what they want

**KEY PHRASE RULES:**
- Extract EXACT phrases from the JD, not your paraphrase
- Phrases should be 2-6 words (not single words, not full sentences)
- Prioritize phrases that describe WHAT THEY WANT, not generic fluff
- Include action phrases ("define and evolve", "lead and mentor")
- Include outcome phrases ("fuels growth", "unlocks acquisition")
- Include capability phrases ("strategic thinking", "cross-functional collaboration")

**WEIGHT EACH PHRASE:**
- HIGH: Appears in title, first paragraph, or repeated 2+ times
- MEDIUM: Emphasized (bold, bullets) or tied to "must have"
- LOW: Nice-to-have or generic

### STAGE 3: GLOBAL PHRASE FREQUENCY

After extracting phrases from all sections, identify phrases that appear MULTIPLE TIMES across the JD. These are the most important signals.

For each repeated phrase, note:
- The exact phrase
- How many times it appears
- Which sections it appears in

### STAGE 4: THEMES

Identify 3-5 overarching themes the JD emphasizes. For each theme:
- Name it clearly (e.g., "Brand-to-Business Outcomes")
- List 2-3 evidence phrases from the JD
- Assign priority: Critical (dealbreaker), High (important), Medium (helpful), Low (nice-to-have)

### STAGE 5: SECTION-TO-RESUME MAPPING

For each JD section, determine which resume component(s) should address it:
- **Summary**: High-level positioning, philosophy, value proposition
- **CH**: Major achievements that prove capability (Career Highlights)
- **P1**: Most recent, most relevant experience
- **P2**: Supporting evidence of pattern
- **P3-P6**: Earlier roles showing trajectory

Some JD sections may be best addressed in MULTIPLE resume components.

### STAGE 6: GAP IDENTIFICATION

Based on common brand strategist / marketing leader profiles, identify requirements in this JD that may be HARD TO DEMONSTRATE:
- Technical skills not commonly held (SEO, link building, etc.)
- Industry-specific experience
- Specific tools or platforms
- Unusual scope combinations

For each gap:
- State the requirement
- Rate risk level (High/Medium/Low)
- Suggest mitigation approach

---

## OUTPUT FORMAT

Return ONLY valid JSON matching this structure:

{
  "metadata": {
    "company": "string",
    "title": "string",
    "industry": "string",
    "level": "string",
    "location": "string or null",
    "reportsTo": "string or null"
  },
  
  "sections": [
    {
      "name": "Section Name",
      "summary": "1-2 sentence summary",
      "keyPhrases": [
        { "phrase": "exact phrase from JD", "weight": "HIGH" }
      ]
    }
  ],
  
  "globalPhraseFrequency": [
    {
      "phrase": "repeated phrase",
      "count": 3,
      "sectionsFound": ["Section 1", "Section 2"]
    }
  ],
  
  "themes": [
    {
      "theme": "Theme Name",
      "evidence": ["phrase 1", "phrase 2"],
      "priority": "Critical"
    }
  ],
  
  "sectionToResumeMapping": [
    {
      "jdSection": "Brand Strategy & Governance",
      "bestAddressedBy": ["Summary", "CH", "P1"]
    }
  ],
  
  "gaps": [
    {
      "requirement": "SEO content frameworks",
      "riskLevel": "High",
      "notes": "Mentioned 2x as key skill. Need to demonstrate or address adjacent experience."
    }
  ]
}

---

## QUALITY CHECKLIST

Before responding, verify:
1. Did I extract EXACT phrases from the JD (not my own words)?
2. Did I identify phrases that repeat across sections?
3. Did I weight HIGH the phrases in title, first paragraph, or repeated?
4. Did I map every JD section to at least one resume component?
5. Did I identify gaps that a typical brand strategist might struggle with?
6. Is my JSON valid and complete?

Return ONLY the JSON object.`;
}
```

---

## Summary Chat Prompt

```typescript
// src/lib/v3/prompts/summary-chat.ts

import { JDAnalyzerOutput, SummarySource, ProfileHeader } from '../types';
import { UMBERTO_VOICE_GUIDE } from '../../voice-guide';

export function buildSummaryChatPrompt(
  jdAnalysis: JDAnalyzerOutput,
  summaries: SummarySource[],
  profileHeader: ProfileHeader,
  previousIssues?: string[]
): string {

  const retryBlock = previousIssues ? `
## âš ï¸ RETRY REQUIRED

Your previous attempt had these issues:
${previousIssues.map(i => `- ${i}`).join('\n')}

Fix these issues in this attempt.

---
` : '';

  // Format JD sections for positioning analysis
  const jdSectionsText = jdAnalysis.sections.map(section => {
    const highPhrases = section.keyPhrases
      .filter(p => p.weight === 'HIGH')
      .map(p => \`"\${p.phrase}"\`)
      .join(', ');
    return \`**\${section.name}**: \${section.summary}
  HIGH phrases: \${highPhrases || 'none'}\`;
  }).join('\n\n');

  // Format themes
  const themesText = jdAnalysis.themes
    .map(t => \`- **\${t.theme}** [\${t.priority}]: \${t.evidence.slice(0, 2).join(', ')}\`)
    .join('\n');

  // Format top repeated phrases
  const topPhrases = jdAnalysis.globalPhraseFrequency
    .slice(0, 8)
    .map(p => \`"\${p.phrase}" (\${p.count}x)\`)
    .join(', ');

  // Format gaps
  const gapsText = jdAnalysis.gaps
    .filter(g => g.riskLevel === 'High' || g.riskLevel === 'Medium')
    .map(g => \`- \${g.requirement} [\${g.riskLevel}]\`)
    .join('\n');

  // Format summary sources
  const sourcesText = summaries.map(s => \`### \${s.id} â€” \${s.label}
**Emphasizes:** \${s.emphasis.join(', ')}

\${s.content}\`).join('\n\n---\n\n');

  // Format HIGH phrases for integration
  const highPhrasesForIntegration = jdAnalysis.sections
    .flatMap(s => s.keyPhrases.filter(p => p.weight === 'HIGH'))
    .slice(0, 6)
    .map(p => \`- "\${p.phrase}"\`)
    .join('\n');

  return \`You are an elite resume strategist writing the Summary section that will set the tone for an entire executive resume.

\${retryBlock}

\${UMBERTO_VOICE_GUIDE}

---

## YOUR MISSION

Write a 140-160 word Summary that:
1. Positions this candidate perfectly for THIS specific role
2. Establishes a compelling narrative that Career Highlights and Position bullets will reinforce
3. Shows personality â€” make someone want to meet this person
4. Weaves JD language naturally (not keyword stuffing)

The Summary you write will be the FIRST thing a hiring manager reads. Everything else in the resume builds on the story you establish here.

---

## TARGET ROLE

**Company:** \${jdAnalysis.metadata.company}
**Title:** \${jdAnalysis.metadata.title}
**Industry:** \${jdAnalysis.metadata.industry}
**Level:** \${jdAnalysis.metadata.level}

---

## JD ANALYSIS

### Sections & What They Want

\${jdSectionsText}

### Themes to Demonstrate (prioritized)

\${themesText}

### Most Repeated Phrases

\${topPhrases}

### Identified Gaps/Risks

\${gapsText || 'None critical'}

---

## POSITIONING DECISION

Before writing, you must decide HOW to position this candidate. Consider:

**Option A: Lead with Industry Expertise**
"Financial services brand strategist who..." â€” Best if JD emphasizes industry-specific experience

**Option B: Lead with Capability/Function**
"Brand strategist who drives revenue through..." â€” Best if JD emphasizes what you DO over where you've done it

**Option C: Lead with Transformation/Impact**
"Fifteen years transforming how companies..." â€” Best if JD emphasizes outcomes and change

**Option D: Lead with Philosophy/Approach**
"Great brands drive revenue. That belief has guided..." â€” Best if JD emphasizes thought leadership

For \${jdAnalysis.metadata.company}, analyze which positioning best addresses their priorities, then commit to ONE angle.

---

## SUMMARY SOURCES

You have \${summaries.length} thematic summaries to draw from. You may:
- Use one as the primary base and adapt it
- Synthesize elements from 2-3 sources
- Rewrite significantly to fit the positioning angle

**DO NOT copy a source verbatim.** The output must feel tailored to THIS role.

\${sourcesText}

---

## SUMMARY STRUCTURE GUIDE

A strong executive summary follows this arc (140-160 words):

1. **Opening Hook (1-2 sentences)** â€” Distinctive value prop, NOT "Name is a..."
   - Good: "Great brands drive revenue. That belief has guided..."
   - Good: "Financial services brands face a choice: blend in or stand out..."
   - Bad: "Umberto is a seasoned brand strategist with 15 years..."
   - Bad: "Results-driven marketing leader passionate about..."

2. **Pattern of Impact (2-3 sentences)** â€” Proof that this isn't talk
   - Include 2-3 specific metrics that map to JD priorities
   - Vary the types: revenue, growth %, customer outcomes, scale
   - Name industries/contexts that resonate with target role

3. **How You Work (1-2 sentences)** â€” The approach that delivers results
   - Bridge between what you've done and how you think
   - Use JD language naturally here

4. **Closing Philosophy (1 sentence)** â€” Memorable, human, shows POV
   - What you believe about brand/marketing
   - NOT a list of skills or "seeking new opportunities"

---

## JD PHRASE INTEGRATION

Weave these HIGH-weight phrases into the Summary naturally:

\${highPhrasesForIntegration}

**Rules:**
- Use 3-5 JD phrases in the Summary
- Transform them to feel natural: "paid, owned, and earned channels" â†’ "across paid, owned, and earned channels"
- Don't cluster them â€” spread throughout
- HIGH-weight phrases only (MEDIUM/LOW saved for bullets)

---

## OUTPUT FORMAT

Return ONLY valid JSON:

{
  "positioningDecision": {
    "approach": "Lead with Philosophy/Approach",
    "rationale": "Reason for choosing this approach based on JD analysis"
  },
  
  "summary": {
    "content": "The full 140-160 word summary text...",
    "wordCount": 142,
    "sourcesUsed": ["SUM-FS", "SUM-BS"]
  },
  
  "jdMapping": [
    {
      "phraseUsed": "paid, owned, and earned channels",
      "jdSection": "Brand Strategy & Governance",
      "jdPhraseSource": "consistent implementation across paid, owned, and earned channels",
      "exactQuote": true
    }
  ],
  
  "thematicAnchors": {
    "primaryNarrative": "One-sentence throughline for entire resume",
    "distinctiveValue": "What makes candidate unique for THIS role",
    "toneEstablished": "Description of voice/personality set",
    
    "doNotRepeat": {
      "metrics": ["$727M", "40% acquisition efficiency"],
      "clients": [],
      "phrases": ["great brands drive revenue", "fifteen years"]
    },
    
    "reinforce": {
      "beliefs": ["brand drives revenue", "measurable outcomes"],
      "capabilities": ["editorial + performance bridge", "organic growth"]
    }
  },
  
  "stateForDownstream": {
    "usedVerbs": ["transforming", "launching", "repositioning"],
    "usedMetrics": ["$727M", "40% acquisition efficiency"],
    "jdPhrasesUsed": ["paid, owned, and earned channels", "authority"],
    "jdSectionsAddressed": ["Brand Strategy & Governance", "Overview"]
  }
}

---

## QUALITY CHECKLIST

Before responding, verify:

1. [ ] Word count is EXACTLY 140-160 (count every word)
2. [ ] Does NOT open with "Umberto is..." or "Name is a..."
3. [ ] Does NOT use forbidden words: "Leveraged", "Utilized", "Spearheaded", "Synergy", "Passion for"
4. [ ] Does NOT contain emdashes (â€”)
5. [ ] Contains 2-3 specific metrics
6. [ ] Uses 3-5 HIGH-weight JD phrases naturally
7. [ ] Each jdMapping entry has exactQuote: true (HIGH phrases only in Summary)
8. [ ] Ends with philosophy/POV, not skills list
9. [ ] thematicAnchors.primaryNarrative is a clear, one-sentence throughline
10. [ ] thematicAnchors.distinctiveValue explains what makes candidate unique for THIS role
11. [ ] doNotRepeat lists metrics/phrases that CH should NOT repeat

Return ONLY the JSON object.\`;
}
```

---

## Career Highlights Chat Prompt

```typescript
// src/lib/v3/prompts/ch-chat.ts

import { JDAnalyzerOutput, SummaryChatOutput, CHSource } from '../types';
import { UMBERTO_VOICE_GUIDE_CONDENSED } from '../../voice-guide';

export function buildCHChatPrompt(
  jdAnalysis: JDAnalyzerOutput,
  chSources: CHSource[],
  summaryOutput: SummaryChatOutput,
  previousIssues?: string[]
): string {

  const retryBlock = previousIssues ? `
## âš ï¸ RETRY REQUIRED

Your previous attempt had these issues:
${previousIssues.map(i => `- ${i}`).join('\n')}

Fix these issues in this attempt.

---
` : '';

  // Format JD sections with phrases
  const jdSectionsText = jdAnalysis.sections.map(section => {
    const phrases = section.keyPhrases
      .map(p => `- "${p.phrase}" [${p.weight}]`)
      .join('\n');
    return `### ${section.name}
${section.summary}

**Key Phrases:**
${phrases}`;
  }).join('\n\n');

  // Format high-frequency phrases
  const topPhrases = jdAnalysis.globalPhraseFrequency
    .slice(0, 10)
    .map(p => `- "${p.phrase}" (${p.count}x: ${p.sectionsFound.join(', ')})`)
    .join('\n');

  // Format themes
  const themesText = jdAnalysis.themes
    .map(t => `- **${t.theme}** [${t.priority}]: ${t.evidence.join(', ')}`)
    .join('\n');

  // Format gaps
  const gapsText = jdAnalysis.gaps
    .map(g => `- ${g.requirement} [${g.riskLevel}]: ${g.notes}`)
    .join('\n');

  // Format CH sources grouped by base ID
  const chSourcesText = formatCHSources(chSources);

  // Format thematic anchors
  const anchors = summaryOutput.thematicAnchors;

  return `You are an elite resume strategist selecting and rewriting Career Highlights for an executive resume.

${retryBlock}

${UMBERTO_VOICE_GUIDE_CONDENSED}

---

## YOUR MISSION

Select 5 Career Highlights that BEST address this job description. For each:
1. Choose the best source (base or variant)
2. Rewrite it to weave in JD language naturally
3. Show EXACTLY which JD phrases you used and which sections they address

The output must include a mapping table for each CH. This is non-negotiable.

---

## TARGET ROLE

**Company:** ${jdAnalysis.metadata.company}
**Title:** ${jdAnalysis.metadata.title}
**Industry:** ${jdAnalysis.metadata.industry}
**Level:** ${jdAnalysis.metadata.level}

---

## JD ANALYSIS

### Sections & Key Phrases

${jdSectionsText}

### Most Repeated Phrases (prioritize these)

${topPhrases}

### Themes to Demonstrate

${themesText}

### Identified Gaps (address if possible)

${gapsText}

---

## THEMATIC ANCHORS FROM SUMMARY

The Summary has established these anchors. Reinforce them, don't contradict:

- **Primary Narrative:** ${anchors.primaryNarrative}
- **Distinctive Value:** ${anchors.distinctiveValue}
- **Tone:** ${anchors.toneEstablished}

**Do NOT repeat these (already used in Summary):**
- Metrics: ${anchors.doNotRepeat.metrics.join(', ') || 'none'}
- Phrases: ${anchors.doNotRepeat.phrases.join(', ') || 'none'}

**MUST reinforce:**
- Beliefs: ${anchors.reinforce.beliefs.join(', ')}
- Capabilities: ${anchors.reinforce.capabilities.join(', ')}

---

## CAREER HIGHLIGHT SOURCES

Select from these. Each base ID has variants â€” choose the variant that best matches the JD.

${chSourcesText}

---

## SELECTION CRITERIA

Rank these factors when choosing CHs:

1. **JD Section Coverage** â€” Does this CH address a critical JD section?
2. **Industry Match** â€” Financial services/fintech CHs > consumer > B2B
3. **Theme Alignment** â€” Does it prove a Critical/High priority theme?
4. **Gap Mitigation** â€” Can it address an identified gap?
5. **Metric Strength** â€” Specific metrics > vague outcomes
6. **Diversity** â€” Don't select 3 CHs about the same thing

**HARD RULES:**
- Each base ID can only be used ONCE (no CH-06-V1 AND CH-06-V3)
- Don't select CHs that use metrics from Summary's doNotRepeat list
- At least 2 CHs must address HIGH-weight JD phrases

---

## REWRITING INSTRUCTIONS

For each selected CH:

1. **Keep all metrics exactly as source** â€” Never change $727M to $700M+
2. **Weave JD phrases naturally** â€” Don't keyword stuff
3. **Bold the headline** â€” Format: **Headline**: Description
4. **35-50 words total** â€” Count them
5. **Start with a strong verb** â€” Not "Led" or "Managed"
6. **Name clients when source names them** â€” Don't remove specificity

**JD Phrase Integration:**
- Use 2-4 JD phrases per CH
- Phrases should feel natural, not forced
- Transform if needed: "paid, owned, and earned" â†’ "across paid, owned, and earned channels"

---

## OUTPUT FORMAT

Return ONLY valid JSON:

{
  "careerHighlights": [
    {
      "slot": "ch-1",
      "sourceId": "CH-06-V3",
      "baseId": "CH-06",
      "headline": "Brand-Led Platform Growth",
      "content": "**Brand-Led Platform Growth**: Architected first global brand strategy...",
      "wordCount": 38,
      "primaryVerb": "Architected",
      
      "jdMapping": [
        {
          "phraseUsed": "brand strategy",
          "jdSection": "Brand Strategy & Governance",
          "jdPhraseSource": "Define and evolve the brand's strategic positioning",
          "exactQuote": true
        }
      ],
      
      "selectionRationale": "Addresses Brand Strategy section directly..."
    }
  ],
  
  "coverageAnalysis": {
    "jdSectionsCovered": [
      {
        "section": "Brand Strategy & Governance",
        "strength": "Strong",
        "coveredBy": ["ch-1", "ch-3"]
      }
    ],
    "gapsRemaining": [
      {
        "gap": "SEO content frameworks",
        "severity": "High",
        "notes": "Address in P1 bullets"
      }
    ]
  },
  
  "stateForDownstream": {
    "usedBaseIds": ["CH-06", "CH-09", "CH-04", "CH-02", "CH-01"],
    "usedVerbs": ["Architected", "Transformed", "Developed", "Scaled", "Built"],
    "usedMetrics": ["67% awareness", "$727M revenue", "5% retention lift"],
    "jdSectionsCoveredByCH": ["Brand Strategy & Governance", "Content & Editorial"]
  }
}

---

## QUALITY CHECKLIST

Before responding, verify:

1. [ ] Selected exactly 5 CHs with no duplicate base IDs
2. [ ] Each CH has a jdMapping with 2-4 entries
3. [ ] Each jdMapping entry cites the exact JD phrase source
4. [ ] Word counts are 35-50 for each CH
5. [ ] No verb is repeated across the 5 CHs
6. [ ] At least 2 CHs address HIGH-weight phrases
7. [ ] Industry-relevant CHs prioritized (fintech/financial services)
8. [ ] No metrics from Summary's doNotRepeat list used
9. [ ] Coverage analysis shows which JD sections remain uncovered
10. [ ] stateForDownstream is complete for P1/P2 chats

Return ONLY the JSON object.`;
}

// Helper to format CH sources
function formatCHSources(sources: CHSource[]): string {
  const grouped = new Map<string, CHSource[]>();
  for (const source of sources) {
    const existing = grouped.get(source.baseId) || [];
    existing.push(source);
    grouped.set(source.baseId, existing);
  }

  const sections: string[] = [];
  for (const [baseId, variants] of grouped) {
    const base = variants.find(v => v.id === baseId);
    const variantList = variants
      .filter(v => v.id !== baseId)
      .map(v => `  - ${v.id} (${v.variantLabel}): ${v.content.substring(0, 100)}...`)
      .join('\n');

    sections.push(`### ${baseId}
**Base:** ${base?.content || 'No base content'}
**Tags:** ${base?.tags.industry.join(', ') || 'none'} | ${base?.tags.function.join(', ') || 'none'}
**Variants:**
${variantList || '  (no variants)'}`);
  }

  return sections.join('\n\n');
}
```

---

## P1 Chat Prompt

```typescript
// src/lib/v3/prompts/p1-chat.ts

import { JDAnalyzerOutput, SummaryChatOutput, CHChatOutput, BulletSource, ProfilePosition } from '../types';
import { UMBERTO_VOICE_GUIDE_CONDENSED } from '../../voice-guide';

export function buildP1ChatPrompt(
  jdAnalysis: JDAnalyzerOutput,
  p1Sources: BulletSource[],
  profilePosition: ProfilePosition,
  summaryOutput: SummaryChatOutput,
  chOutput: CHChatOutput,
  previousIssues?: string[]
): string {

  const retryBlock = previousIssues ? `
## âš ï¸ RETRY REQUIRED

Your previous attempt had these issues:
${previousIssues.map(i => `- ${i}`).join('\n')}

Fix these issues in this attempt.

---
` : '';

  const overviews = p1Sources.filter(s => s.type === 'overview');
  const bullets = p1Sources.filter(s => s.type === 'bullet');

  // Format JD sections with coverage status
  const jdCoverageText = formatJDCoverageStatus(jdAnalysis, chOutput);

  // Format gaps that P1 must address
  const gapsToFill = formatGapsForP1(jdAnalysis, chOutput);

  // Format phrases P1 should prioritize
  const priorityPhrases = formatPriorityPhrases(jdAnalysis, chOutput);

  // Format banned items from CH
  const bannedState = formatBannedState(chOutput, summaryOutput);

  const overviewsText = formatOverviews(overviews);
  const bulletsText = formatBullets(bullets);

  const anchors = summaryOutput.thematicAnchors;

  return `You are an elite resume strategist writing Position 1 content (current role) for an executive resume.

${retryBlock}

${UMBERTO_VOICE_GUIDE_CONDENSED}

---

## YOUR MISSION

Write the Position 1 section:
- 1 Overview (40-60 words) â€” Sets context for the role
- 4 Bullets (25-40 words each) â€” Tactical achievements with metrics

Your job is to FILL GAPS left by Career Highlights while adding tactical depth. Every bullet must map to specific JD phrases.

---

## TARGET ROLE

**Company:** ${jdAnalysis.metadata.company}
**Title:** ${jdAnalysis.metadata.title}
**Industry:** ${jdAnalysis.metadata.industry}

---

## YOUR COVERAGE RESPONSIBILITY

Based on the JD analysis and what Career Highlights already covered:

### JD Sections You MUST Address (gaps from CH)
${gapsToFill.mustAddress.map(s => `- **${s.section}** â€” ${s.reason}`).join('\n') || '(none)'}

### JD Sections to REINFORCE (partially covered by CH)
${gapsToFill.reinforce.map(s => `- ${s.section} â€” CH covered: ${s.chCovered}, you add: ${s.youAdd}`).join('\n') || '(none)'}

### JD Sections NOT Your Responsibility (P2 or already strong)
${gapsToFill.notYours.join(', ') || '(none)'}

---

## JD COVERAGE STATUS (from Career Highlights)

${jdCoverageText}

---

## PRIORITY PHRASES FOR P1

These JD phrases were NOT used in Career Highlights. Use them here:

**HIGH Priority (must use at least 2):**
${priorityPhrases.high.map(p => `- "${p.phrase}" [${p.jdSection}]`).join('\n') || '(all HIGH phrases covered)'}

**MEDIUM Priority (use if natural):**
${priorityPhrases.medium.map(p => `- "${p.phrase}" [${p.jdSection}]`).join('\n') || '(none remaining)'}

---

## BANNED â€” Do NOT Use

${bannedState}

---

## THEMATIC ANCHORS (Reinforce, Don't Contradict)

**Primary Narrative:** ${anchors.primaryNarrative}
**Distinctive Value:** ${anchors.distinctiveValue}

---

## POSITION 1 CONTEXT

**Company:** ${profilePosition.company}
**Title:** ${profilePosition.title}
**Dates:** ${profilePosition.startDate} - ${profilePosition.endDate}
**Location:** ${profilePosition.location}

This is the CURRENT role. Content should emphasize:
- Leadership scope (team size, revenue responsibility)
- Strategic impact (not just execution)
- Client outcomes with metrics

---

## P1 OVERVIEW SOURCES

Select ONE overview and rewrite it:

${overviewsText}

---

## P1 BULLET SOURCES

Select FOUR bullets and rewrite them:

${bulletsText}

---

## SELECTION CRITERIA

For each bullet, prioritize:

1. **Gap Coverage** â€” Does it address a JD section CH missed?
2. **Unused Phrases** â€” Does it let you use priority JD phrases?
3. **Metric Strength** â€” Specific metrics > vague outcomes
4. **Industry Relevance** â€” Financial services examples > other industries
5. **Diversity** â€” Don't pick 3 bullets about the same topic

**HARD RULES:**
- Cannot use any baseId in usedBaseIds
- Cannot use any metric in usedMetrics
- Cannot start any bullet with a verb in usedVerbs
- At least 2 bullets must address HIGH priority phrases

---

## REWRITING INSTRUCTIONS

### Overview (40-60 words)
- Sets context: what you were hired to do, scope of role
- Include 1-2 JD phrases naturally
- Don't repeat Career Highlight metrics
- Can mention team size, revenue responsibility, client types

### Bullets (25-40 words each)
- Start with strong, unique verb
- Include specific metric from source (exact, not rounded)
- Weave 1-2 JD phrases per bullet
- Name clients when source names them
- CAR structure: Challenge â†’ Action â†’ Result (implicit)

---

## OUTPUT FORMAT

Return ONLY valid JSON:

{
  "overview": {
    "sourceId": "OV-P1-03",
    "content": "Overview text here...",
    "wordCount": 42,
    
    "jdMapping": [
      {
        "phraseUsed": "authority",
        "jdSection": "Content & Editorial",
        "jdPhraseSource": "strengthens Bankrate's authority",
        "exactQuote": true
      }
    ]
  },
  
  "bullets": [
    {
      "slot": "p1-bullet-1",
      "sourceId": "P1-B01-V2",
      "baseId": "P1-B01",
      "content": "Bullet text here...",
      "wordCount": 34,
      "primaryVerb": "Created",
      
      "jdMapping": [
        {
          "phraseUsed": "cross-functional",
          "jdSection": "Overview",
          "jdPhraseSource": "cross-functional collaboration",
          "exactQuote": true
        }
      ],
      
      "gapAddressed": "Cross-functional leadership (not covered by CH)",
      "selectionRationale": "Financial services example addresses industry requirement..."
    }
  ],
  
  "coverageAnalysis": {
    "jdSectionsAddressed": [
      {
        "section": "Communications",
        "strength": "Strong",
        "coveredBy": ["p1-bullet-2", "p1-bullet-4"]
      }
    ],
    "gapsRemaining": [
      {
        "gap": "SEO content frameworks",
        "severity": "High",
        "notes": "Address in P2 if content exists"
      }
    ],
    "phrasesCovered": ["cross-functional", "authority", "visibility"]
  },
  
  "stateForDownstream": {
    "usedBaseIds": ["P1-B01", "P1-B06", "P1-B04", "P1-B05"],
    "usedVerbs": ["Created", "Scaled", "Drove", "Unified"],
    "usedMetrics": ["9% customer acquisition", "64% revenue growth"],
    "jdSectionsCoveredByP1": ["Communications", "Creative & Campaign"]
  }
}

---

## QUALITY CHECKLIST

Before responding, verify:

1. [ ] Overview is 40-60 words (count them)
2. [ ] Each bullet is 25-40 words (count them)
3. [ ] Exactly 4 bullets selected
4. [ ] No baseId from usedBaseIds was selected
5. [ ] No metric from usedMetrics appears in output
6. [ ] No verb from usedVerbs starts a bullet
7. [ ] At least 2 bullets use HIGH priority phrases
8. [ ] Each bullet has jdMapping with 1-2 entries
9. [ ] gapAddressed field explains what JD gap this fills
10. [ ] stateForDownstream is complete for P2 chat

Return ONLY the JSON object.`;
}

// Helper functions

function formatJDCoverageStatus(jdAnalysis: JDAnalyzerOutput, chOutput: CHChatOutput): string {
  return chOutput.coverageAnalysis.jdSectionsCovered
    .map(s => {
      const icon = s.strength === 'Strong' ? 'âœ…' : s.strength === 'Partial' ? 'âš ï¸' : 'âŒ';
      const coveredBy = s.coveredBy.length > 0 ? s.coveredBy.join(', ') : 'None';
      return `${icon} **${s.section}**: ${s.strength} (covered by: ${coveredBy})`;
    })
    .join('\n');
}

function formatGapsForP1(jdAnalysis: JDAnalyzerOutput, chOutput: CHChatOutput): {
  mustAddress: { section: string; reason: string }[];
  reinforce: { section: string; chCovered: string; youAdd: string }[];
  notYours: string[];
} {
  const gaps = chOutput.coverageAnalysis.jdSectionsCovered;
  
  const mustAddress = gaps
    .filter(g => g.strength === 'Gap')
    .map(g => ({
      section: g.section,
      reason: 'Not covered by Career Highlights'
    }));

  const reinforce = gaps
    .filter(g => g.strength === 'Partial')
    .map(g => ({
      section: g.section,
      chCovered: g.coveredBy.join(', ') || 'mentioned',
      youAdd: 'Tactical proof with metrics'
    }));

  const notYours = gaps
    .filter(g => g.strength === 'Strong')
    .map(g => g.section);

  return { mustAddress, reinforce, notYours };
}

function formatPriorityPhrases(jdAnalysis: JDAnalyzerOutput, chOutput: CHChatOutput): {
  high: { phrase: string; jdSection: string }[];
  medium: { phrase: string; jdSection: string }[];
} {
  // Get all phrases used by CH
  const usedPhrases = new Set<string>();
  for (const ch of chOutput.careerHighlights) {
    for (const mapping of ch.jdMapping) {
      usedPhrases.add(mapping.phraseUsed.toLowerCase());
    }
  }

  const high: { phrase: string; jdSection: string }[] = [];
  const medium: { phrase: string; jdSection: string }[] = [];

  for (const section of jdAnalysis.sections) {
    for (const phrase of section.keyPhrases) {
      if (usedPhrases.has(phrase.phrase.toLowerCase())) continue;
      
      if (phrase.weight === 'HIGH') {
        high.push({ phrase: phrase.phrase, jdSection: section.name });
      } else if (phrase.weight === 'MEDIUM') {
        medium.push({ phrase: phrase.phrase, jdSection: section.name });
      }
    }
  }

  return { high: high.slice(0, 6), medium: medium.slice(0, 6) };
}

function formatBannedState(chOutput: CHChatOutput, summaryOutput: SummaryChatOutput): string {
  const chState = chOutput.stateForDownstream;
  const summaryState = summaryOutput.stateForDownstream;
  
  const allBaseIds = [...chState.usedBaseIds];
  const allVerbs = [...new Set([...summaryState.usedVerbs, ...chState.usedVerbs])];
  const allMetrics = [...new Set([...summaryState.usedMetrics, ...chState.usedMetrics])];
  
  return `**Base IDs:** ${allBaseIds.join(', ')}
**Verbs:** ${allVerbs.join(', ')}
**Metrics:** ${allMetrics.join(' â€¢ ')}`;
}

function formatOverviews(overviews: BulletSource[]): string {
  return overviews.map(o => `### ${o.id}${o.variantLabel ? ` (${o.variantLabel})` : ''}
${o.content}`).join('\n\n');
}

function formatBullets(bullets: BulletSource[]): string {
  const grouped = new Map<string, BulletSource[]>();
  for (const bullet of bullets) {
    const existing = grouped.get(bullet.baseId) || [];
    existing.push(bullet);
    grouped.set(bullet.baseId, existing);
  }

  const sections: string[] = [];
  for (const [baseId, variants] of grouped) {
    const base = variants.find(v => v.id === baseId);
    const variantList = variants
      .filter(v => v.id !== baseId)
      .map(v => `  - **${v.id}** (${v.variantLabel}): ${v.content.substring(0, 80)}...`)
      .join('\n');

    sections.push(`### ${baseId}
**Tags:** ${base?.tags.industry.join(', ') || 'none'} | ${base?.tags.function.join(', ') || 'none'}
${base?.content || 'No base content'}
${variantList ? `\n**Variants:**\n${variantList}` : ''}`);
  }

  return sections.join('\n\n');
}
```

---

## P2 Chat Prompt

```typescript
// src/lib/v3/prompts/p2-chat.ts

import { JDAnalyzerOutput, SummaryChatOutput, CHChatOutput, P1ChatOutput, BulletSource, ProfilePosition } from '../types';
import { UMBERTO_VOICE_GUIDE_CONDENSED } from '../../voice-guide';

export function buildP2ChatPrompt(
  jdAnalysis: JDAnalyzerOutput,
  p2Sources: BulletSource[],
  profilePosition: ProfilePosition,
  summaryOutput: SummaryChatOutput,
  chOutput: CHChatOutput,
  p1Output: P1ChatOutput,
  previousIssues?: string[]
): string {

  const retryBlock = previousIssues ? `
## âš ï¸ RETRY REQUIRED

Your previous attempt had these issues:
${previousIssues.map(i => `- ${i}`).join('\n')}

Fix these issues in this attempt.

---
` : '';

  const overviews = p2Sources.filter(s => s.type === 'overview');
  const bullets = p2Sources.filter(s => s.type === 'bullet');

  // Merge state from CH and P1
  const allUsedBaseIds = [...chOutput.stateForDownstream.usedBaseIds, ...p1Output.stateForDownstream.usedBaseIds];
  const allUsedVerbs = [...new Set([
    ...summaryOutput.stateForDownstream.usedVerbs,
    ...chOutput.stateForDownstream.usedVerbs,
    ...p1Output.stateForDownstream.usedVerbs
  ])];
  const allUsedMetrics = [...new Set([
    ...summaryOutput.stateForDownstream.usedMetrics,
    ...chOutput.stateForDownstream.usedMetrics,
    ...p1Output.stateForDownstream.usedMetrics
  ])];

  // Calculate remaining gaps
  const remainingGaps = calculateRemainingGaps(jdAnalysis, chOutput, p1Output);
  
  // Find unused phrases
  const unusedPhrases = findUnusedPhrases(jdAnalysis, summaryOutput, chOutput, p1Output);

  const overviewsText = formatOverviews(overviews);
  const bulletsText = formatBullets(bullets);

  const anchors = summaryOutput.thematicAnchors;

  return `You are an elite resume strategist writing Position 2 content (previous role) for an executive resume.

${retryBlock}

${UMBERTO_VOICE_GUIDE_CONDENSED}

---

## YOUR MISSION

Write the Position 2 section:
- 1 Overview (40-60 words) â€” Sets context for this earlier role
- 3 Bullets (25-40 words each) â€” Supporting achievements that reinforce the P1 story

P2 proves that P1 wasn't a one-off. Show a PATTERN of capability, not just repetition.

---

## TARGET ROLE

**Company:** ${jdAnalysis.metadata.company}
**Title:** ${jdAnalysis.metadata.title}
**Industry:** ${jdAnalysis.metadata.industry}

---

## POSITION 2 CONTEXT

**Company:** ${profilePosition.company}
**Title:** ${profilePosition.title}
**Dates:** ${profilePosition.startDate} - ${profilePosition.endDate}
**Location:** ${profilePosition.location}

This is the PREVIOUS role. Content should:
- Show earlier proof of capabilities demonstrated in P1
- Emphasize growth trajectory (what led to P1 opportunity)
- Use different examples than P1 (prove breadth, not repetition)

---

## YOUR COVERAGE RESPONSIBILITY

### Remaining Gaps to Address
${remainingGaps.gaps.length > 0 
  ? remainingGaps.gaps.map(g => `- **${g.section}**: ${g.status}`).join('\n')
  : 'âœ… No critical gaps remain. Focus on reinforcement.'}

### Reinforcement Opportunities
${remainingGaps.reinforce.map(r => `- ${r.section}: Add different angle than P1's "${r.p1Example}"`).join('\n') || '(none)'}

### Already Strong (don't over-index)
${remainingGaps.strong.join(', ') || 'None'}

---

## UNUSED JD PHRASES

These phrases haven't been used yet. Work them in if natural:

**HIGH weight:** ${unusedPhrases.high.length > 0 ? unusedPhrases.high.map(p => `"${p}"`).join(', ') : 'All covered âœ…'}

**MEDIUM weight:** ${unusedPhrases.medium.length > 0 ? unusedPhrases.medium.map(p => `"${p}"`).join(', ') : 'All covered âœ…'}

---

## BANNED â€” Do NOT Use

**Base IDs:** ${allUsedBaseIds.join(', ')}
**Verbs:** ${allUsedVerbs.join(', ')}
**Metrics:** ${allUsedMetrics.join(' â€¢ ')}

---

## THEMATIC ANCHORS

**Primary Narrative:** ${anchors.primaryNarrative}

**Pattern to Prove:** Show that the P1 story has roots â€” this role built the foundation.

---

## P2 OVERVIEW SOURCES

Select ONE and rewrite:

${overviewsText}

---

## P2 BULLET SOURCES

Select THREE and rewrite:

${bulletsText}

---

## SELECTION CRITERIA

1. **Pattern Proof** â€” Does it show earlier evidence of P1 capabilities?
2. **Gap Coverage** â€” Does it address remaining gaps (if any)?
3. **Differentiation** â€” Is it a DIFFERENT angle than P1 bullets?
4. **Metric Strength** â€” Specific metrics > vague outcomes
5. **Relevance** â€” Financial services / brand strategy examples preferred

**HARD RULES:**
- Cannot use any baseId already used
- Cannot start bullets with any used verb
- Cannot repeat any used metric
- Must use at least 1 HIGH-weight unused phrase (if any remain)

---

## OUTPUT FORMAT

Return ONLY valid JSON:

{
  "overview": {
    "sourceId": "OV-P2-02",
    "content": "Overview text here...",
    "wordCount": 38,
    
    "jdMapping": [
      {
        "phraseUsed": "strategic rigor",
        "jdSection": "Skills",
        "jdPhraseSource": "Strong strategic thinking",
        "exactQuote": false
      }
    ]
  },
  
  "bullets": [
    {
      "slot": "p2-bullet-1",
      "sourceId": "P2-B04-V1",
      "baseId": "P2-B04",
      "content": "Bullet text here...",
      "wordCount": 31,
      "primaryVerb": "Repositioned",
      
      "jdMapping": [
        {
          "phraseUsed": "communications strategy",
          "jdSection": "Communications",
          "jdPhraseSource": "integrated communications strategy",
          "exactQuote": true
        }
      ],
      
      "gapAddressed": "Reinforces Communications with different example than P1",
      "patternProof": "Shows brand communications capability predates P1 role",
      "selectionRationale": "..."
    }
  ],
  
  "coverageAnalysis": {
    "finalCoverage": [
      { "section": "Brand Strategy & Governance", "strength": "Strong", "coveredBy": ["ch-1", "ch-3", "p1-bullet-2"] },
      { "section": "Content & Editorial", "strength": "Partial", "coveredBy": ["ch-4"] }
    ],
    "remainingGaps": [
      { "gap": "SEO content frameworks", "severity": "Acknowledged", "notes": "No content in library addresses this directly" }
    ],
    "unusedHighPhrases": []
  },
  
  "stateForDownstream": {
    "usedBaseIds": ["P2-B04", "P2-B06", "P2-B03"],
    "usedVerbs": ["Repositioned", "Developed", "Built"],
    "allVerbsUsedInResume": ["Architected", "Transformed", "Developed", "Scaled", "Built", "Created", "Drove", "Unified", "Repositioned"]
  }
}

---

## QUALITY CHECKLIST

1. [ ] Overview is 40-60 words
2. [ ] Each bullet is 25-40 words  
3. [ ] Exactly 3 bullets selected
4. [ ] No banned baseIds, verbs, or metrics used
5. [ ] At least 1 unused HIGH phrase incorporated (if any remained)
6. [ ] Each bullet shows DIFFERENT angle than P1
7. [ ] patternProof field explains how this supports P1 story
8. [ ] finalCoverage shows cumulative JD coverage
9. [ ] remainingGaps honestly notes what couldn't be addressed

Return ONLY the JSON object.`;
}

// Helper functions (similar to P1, adapted for P2 context)

function calculateRemainingGaps(
  jdAnalysis: JDAnalyzerOutput,
  chOutput: CHChatOutput,
  p1Output: P1ChatOutput
): { gaps: { section: string; status: string }[]; reinforce: { section: string; p1Example: string }[]; strong: string[] } {
  const chCoverage = chOutput.coverageAnalysis.jdSectionsCovered;
  const p1Coverage = p1Output.coverageAnalysis.jdSectionsAddressed;
  
  const gaps: { section: string; status: string }[] = [];
  const reinforce: { section: string; p1Example: string }[] = [];
  const strong: string[] = [];

  for (const section of jdAnalysis.sections) {
    const chStrength = chCoverage.find(c => c.section === section.name)?.strength || 'Gap';
    const p1Addressed = p1Coverage.find(c => c.section === section.name);
    
    if (chStrength === 'Strong' && p1Addressed?.strength === 'Strong') {
      strong.push(section.name);
    } else if (chStrength === 'Gap' && !p1Addressed) {
      gaps.push({ section: section.name, status: 'Not addressed by CH or P1' });
    } else if (p1Addressed?.strength === 'Partial' || p1Addressed?.strength === 'Strong') {
      reinforce.push({ 
        section: section.name, 
        p1Example: p1Addressed.coveredBy[0] || 'P1 bullet' 
      });
    }
  }

  return { gaps, reinforce, strong };
}

function findUnusedPhrases(
  jdAnalysis: JDAnalyzerOutput,
  summaryOutput: SummaryChatOutput,
  chOutput: CHChatOutput,
  p1Output: P1ChatOutput
): { high: string[]; medium: string[] } {
  const usedPhrases = new Set<string>();
  
  // From Summary
  for (const mapping of summaryOutput.jdMapping) {
    usedPhrases.add(mapping.phraseUsed.toLowerCase());
  }
  
  // From CH
  for (const ch of chOutput.careerHighlights) {
    for (const mapping of ch.jdMapping) {
      usedPhrases.add(mapping.phraseUsed.toLowerCase());
    }
  }
  
  // From P1
  if (p1Output.overview?.jdMapping) {
    for (const mapping of p1Output.overview.jdMapping) {
      usedPhrases.add(mapping.phraseUsed.toLowerCase());
    }
  }
  for (const bullet of p1Output.bullets) {
    for (const mapping of bullet.jdMapping) {
      usedPhrases.add(mapping.phraseUsed.toLowerCase());
    }
  }

  const high: string[] = [];
  const medium: string[] = [];

  for (const section of jdAnalysis.sections) {
    for (const phrase of section.keyPhrases) {
      if (!usedPhrases.has(phrase.phrase.toLowerCase())) {
        if (phrase.weight === 'HIGH') {
          high.push(phrase.phrase);
        } else if (phrase.weight === 'MEDIUM') {
          medium.push(phrase.phrase);
        }
      }
    }
  }

  return { high: [...new Set(high)], medium: [...new Set(medium)] };
}

function formatOverviews(overviews: BulletSource[]): string {
  return overviews.map(o => `### ${o.id}${o.variantLabel ? ` (${o.variantLabel})` : ''}
${o.content}`).join('\n\n');
}

function formatBullets(bullets: BulletSource[]): string {
  const grouped = new Map<string, BulletSource[]>();
  for (const bullet of bullets) {
    const existing = grouped.get(bullet.baseId) || [];
    existing.push(bullet);
    grouped.set(bullet.baseId, existing);
  }

  const sections: string[] = [];
  for (const [baseId, variants] of grouped) {
    const base = variants.find(v => v.id === baseId);
    const variantList = variants
      .filter(v => v.id !== baseId)
      .map(v => `  - **${v.id}** (${v.variantLabel}): ${v.content.substring(0, 80)}...`)
      .join('\n');

    sections.push(`### ${baseId}
**Tags:** ${base?.tags.industry.join(', ') || 'none'} | ${base?.tags.function.join(', ') || 'none'}
${base?.content || 'No base content'}
${variantList ? `\n**Variants:**\n${variantList}` : ''}`);
  }

  return sections.join('\n\n');
}
```

---

## P3-P6 Chat Prompt

```typescript
// src/lib/v3/prompts/p3p6-chat.ts

import { JDAnalyzerOutput, BulletSource, ProfilePosition } from '../types';
import { UMBERTO_VOICE_GUIDE_CONDENSED } from '../../voice-guide';

export function buildP3P6ChatPrompt(
  jdAnalysis: JDAnalyzerOutput,
  overviewSources: BulletSource[],
  positions: ProfilePosition[],
  allUsedVerbs: string[],
  previousIssues?: string[]
): string {

  const retryBlock = previousIssues ? `
## âš ï¸ RETRY REQUIRED

Your previous attempt had these issues:
${previousIssues.map(i => `- ${i}`).join('\n')}

Fix these issues in this attempt.

---
` : '';

  // Group overviews by position (3, 4, 5, 6)
  const overviewsByPosition = new Map<number, BulletSource[]>();
  for (const ov of overviewSources) {
    // Extract position number from ID like "OV-P3-01"
    const match = ov.id.match(/OV-P(\d)/);
    if (match) {
      const posNum = parseInt(match[1]);
      const existing = overviewsByPosition.get(posNum) || [];
      existing.push(ov);
      overviewsByPosition.set(posNum, existing);
    }
  }

  // Format positions with their overview options
  const positionsText = positions.map((pos, idx) => {
    const posNum = 3 + idx;
    const overviews = overviewsByPosition.get(posNum) || [];
    const overviewOptions = overviews.length > 0
      ? overviews.map(ov => `- **${ov.id}**: ${ov.content}`).join('\n')
      : '(No overview sources available â€” write fresh based on role context)';

    return `### Position ${posNum}: ${pos.title}
**Company:** ${pos.company}
**Dates:** ${pos.startDate} - ${pos.endDate}
**Location:** ${pos.location}

**Overview Options:**
${overviewOptions}`;
  }).join('\n\n---\n\n');

  return `You are an elite resume strategist writing Position 3-6 overviews (earlier career) for an executive resume.

${retryBlock}

${UMBERTO_VOICE_GUIDE_CONDENSED}

---

## YOUR MISSION

Write 4 position overviews (one each for P3, P4, P5, P6):
- 20-40 words each
- Show career trajectory and growth
- Avoid ALL verbs already used in the resume
- Light JD relevance (if natural, don't force)

These are EARLIER roles. They show foundation and trajectory, not primary proof.

---

## TARGET ROLE CONTEXT

**Company:** ${jdAnalysis.metadata.company}
**Title:** ${jdAnalysis.metadata.title}
**Industry:** ${jdAnalysis.metadata.industry}

Use this context to choose emphasis where options exist, but don't force JD language into early-career roles. Authenticity matters more than keyword density here.

---

## BANNED VERBS

These verbs have been used elsewhere in the resume. DO NOT start any overview with these:

**${allUsedVerbs.join(', ')}**

Each overview should start with a DIFFERENT verb not in this list.

---

## POSITIONS & OVERVIEW OPTIONS

${positionsText}

---

## OVERVIEW GUIDELINES

**Length:** 20-40 words (shorter than P1/P2 overviews)

**Purpose by Position:**
- **P3:** Bridge role â€” shows transition to current trajectory
- **P4:** Foundation â€” early leadership or specialization
- **P5:** Growth â€” learning and skill building
- **P6:** Origin â€” where career began, brief context only

**Voice:**
- Same confident tone as rest of resume
- Complete sentences, not fragments
- No exclamation points
- Present what you DID, not what you were "responsible for"

**JD Relevance:**
- If a source naturally connects to JD themes, use it
- Don't force JD language into roles from 10+ years ago
- Trajectory and growth story matters more than keyword density

---

## OUTPUT FORMAT

Return ONLY valid JSON:

{
  "overviews": [
    {
      "position": 3,
      "sourceId": "OV-P3-02",
      "content": "Promoted to lead innovation across brand, technology, and customer experience...",
      "wordCount": 28,
      "startingVerb": "Promoted",
      
      "jdRelevance": {
        "relevant": true,
        "connection": "data-driven marketing aligns with performance marketing emphasis",
        "phraseUsed": null
      }
    },
    {
      "position": 4,
      "sourceId": "OV-P4-01",
      "content": "Recruited to lead global brand storytelling...",
      "wordCount": 24,
      "startingVerb": "Recruited",
      
      "jdRelevance": {
        "relevant": true,
        "connection": "storytelling directly mentioned in JD",
        "phraseUsed": "storytelling"
      }
    },
    {
      "position": 5,
      "sourceId": "OV-P5-01",
      "content": "Developed foundational brand strategy systems...",
      "wordCount": 22,
      "startingVerb": "Developed",
      
      "jdRelevance": {
        "relevant": false,
        "connection": null,
        "phraseUsed": null
      }
    },
    {
      "position": 6,
      "sourceId": "OV-P6-01",
      "content": "Supported brand positioning and integrated campaign development...",
      "wordCount": 23,
      "startingVerb": "Supported",
      
      "jdRelevance": {
        "relevant": true,
        "connection": "financial services experience, cross-functional mentioned in JD",
        "phraseUsed": "cross-functional"
      }
    }
  ],
  
  "verbsUsed": ["Promoted", "Recruited", "Developed", "Supported"],
  
  "trajectoryNarrative": "Shows progression from agency execution (P6) â†’ B2B strategy (P5) â†’ global brand leadership at GE (P4) â†’ innovation leadership at Omnicom (P3), establishing foundation for Deloitte practice leadership."
}

---

## QUALITY CHECKLIST

1. [ ] Exactly 4 overviews (P3, P4, P5, P6)
2. [ ] Each is 20-40 words
3. [ ] No starting verb appears in the banned list
4. [ ] No starting verb repeats across P3-P6
5. [ ] Each overview is a complete sentence
6. [ ] trajectoryNarrative tells a coherent growth story

Return ONLY the JSON object.`;
}
```

---

## Orchestrator

```typescript
// src/lib/v3/orchestrator.ts

import { v4 as uuidv4 } from 'uuid';
import { callClaude } from '../claude-client';
import { buildJDAnalyzerPrompt } from './prompts/jd-analyzer';
import { buildSummaryChatPrompt } from './prompts/summary-chat';
import { buildCHChatPrompt } from './prompts/ch-chat';
import { buildP1ChatPrompt } from './prompts/p1-chat';
import { buildP2ChatPrompt } from './prompts/p2-chat';
import { buildP3P6ChatPrompt } from './prompts/p3p6-chat';
import { loadContentSources, loadProfile } from '../content-loader';
import { 
  validateJDOutput, 
  validateSummaryOutput, 
  validateCHOutput, 
  validateP1Output, 
  validateP2Output, 
  validateP3P6Output 
} from './validators';
import { 
  V3Input, 
  V3Result, 
  AccumulatedState, 
  V3Diagnostics, 
  StepDiagnostic,
  ValidationResult 
} from './types';

const MAX_RETRIES = 2;
const MODEL = 'claude-sonnet-4-20250514';

export async function runV3Pipeline(input: V3Input): Promise<V3Result> {
  const sessionId = uuidv4();
  const startedAt = new Date().toISOString();
  const diagnostics: V3Diagnostics = {
    sessionId,
    startedAt,
    completedAt: '',
    totalDurationMs: 0,
    totalCost: 0,
    steps: [],
    errors: [],
    warnings: [],
  };

  const state: AccumulatedState = {
    summaryVerbs: [],
    summaryMetrics: [],
    summaryPhrases: [],
    summarySectionsAddressed: [],
    chUsedBaseIds: [],
    chUsedVerbs: [],
    chUsedMetrics: [],
    chCoverage: [],
    p1UsedBaseIds: [],
    p1UsedVerbs: [],
    p1UsedMetrics: [],
    p1SectionsAddressed: [],
    p2UsedBaseIds: [],
    p2UsedVerbs: [],
    allUsedBaseIds: [],
    allUsedVerbs: [],
    allUsedMetrics: [],
  };

  try {
    // Load content sources and profile
    const content = await loadContentSources();
    const profile = await loadProfile(input.profileId);

    // ============ Step 1: JD Analyzer ============
    const jdAnalysis = await runStep({
      stepName: 'jd-analyzer',
      promptBuilder: (issues) => buildJDAnalyzerPrompt(input.jobDescription, issues),
      validator: validateJDOutput,
      diagnostics,
    });

    // ============ Step 2: Summary Chat ============
    const summaryOutput = await runStep({
      stepName: 'summary',
      promptBuilder: (issues) => buildSummaryChatPrompt(
        jdAnalysis,
        content.summaries,
        profile.header,
        issues
      ),
      validator: validateSummaryOutput,
      diagnostics,
    });

    // Update state from Summary
    state.thematicAnchors = summaryOutput.thematicAnchors;
    state.summaryVerbs = summaryOutput.stateForDownstream.usedVerbs;
    state.summaryMetrics = summaryOutput.stateForDownstream.usedMetrics;
    state.summaryPhrases = summaryOutput.stateForDownstream.jdPhrasesUsed;
    state.summarySectionsAddressed = summaryOutput.stateForDownstream.jdSectionsAddressed;
    updateAggregates(state);

    // ============ Step 3: CH Chat ============
    const chOutput = await runStep({
      stepName: 'ch',
      promptBuilder: (issues) => buildCHChatPrompt(
        jdAnalysis,
        content.careerHighlights,
        summaryOutput,
        issues
      ),
      validator: (output) => validateCHOutput(output, state),
      diagnostics,
    });

    // Update state from CH
    state.chUsedBaseIds = chOutput.stateForDownstream.usedBaseIds;
    state.chUsedVerbs = chOutput.stateForDownstream.usedVerbs;
    state.chUsedMetrics = chOutput.stateForDownstream.usedMetrics;
    state.chCoverage = chOutput.coverageAnalysis.jdSectionsCovered;
    updateAggregates(state);

    // ============ Step 4: P1 Chat ============
    const p1Output = await runStep({
      stepName: 'p1',
      promptBuilder: (issues) => buildP1ChatPrompt(
        jdAnalysis,
        content.p1Sources,
        profile.positions[0],
        summaryOutput,
        chOutput,
        issues
      ),
      validator: (output) => validateP1Output(output, state),
      diagnostics,
    });

    // Update state from P1
    state.p1UsedBaseIds = p1Output.stateForDownstream.usedBaseIds;
    state.p1UsedVerbs = p1Output.stateForDownstream.usedVerbs;
    state.p1UsedMetrics = p1Output.stateForDownstream.usedMetrics;
    state.p1SectionsAddressed = p1Output.stateForDownstream.jdSectionsCoveredByP1;
    updateAggregates(state);

    // ============ Step 5: P2 Chat ============
    const p2Output = await runStep({
      stepName: 'p2',
      promptBuilder: (issues) => buildP2ChatPrompt(
        jdAnalysis,
        content.p2Sources,
        profile.positions[1],
        summaryOutput,
        chOutput,
        p1Output,
        issues
      ),
      validator: (output) => validateP2Output(output, state),
      diagnostics,
    });

    // Update state from P2
    state.p2UsedBaseIds = p2Output.stateForDownstream.usedBaseIds;
    state.p2UsedVerbs = p2Output.stateForDownstream.usedVerbs;
    state.allUsedVerbs = p2Output.stateForDownstream.allVerbsUsedInResume;
    updateAggregates(state);

    // ============ Step 6: P3-P6 Chat ============
    const p3p6Output = await runStep({
      stepName: 'p3p6',
      promptBuilder: (issues) => buildP3P6ChatPrompt(
        jdAnalysis,
        content.p3p6Overviews,
        profile.positions.slice(2, 6),
        state.allUsedVerbs,
        issues
      ),
      validator: (output) => validateP3P6Output(output, state),
      diagnostics,
    });

    // ============ Finalize ============
    const completedAt = new Date().toISOString();
    diagnostics.completedAt = completedAt;
    diagnostics.totalDurationMs = new Date(completedAt).getTime() - new Date(startedAt).getTime();
    diagnostics.totalCost = diagnostics.steps.reduce((sum, s) => sum + s.cost, 0);

    return {
      success: true,
      sessionId,
      jdAnalysis,
      summary: summaryOutput,
      careerHighlights: chOutput,
      position1: p1Output,
      position2: p2Output,
      positions3to6: p3p6Output,
      finalCoverage: {
        jdSections: p2Output.coverageAnalysis.finalCoverage,
        gaps: p2Output.coverageAnalysis.remainingGaps,
        unusedHighPhrases: p2Output.coverageAnalysis.unusedHighPhrases,
      },
      diagnostics,
    };

  } catch (error) {
    diagnostics.errors.push({
      step: 'orchestrator',
      error: error instanceof Error ? error.message : String(error),
      fatal: true,
    });
    
    throw new V3PipelineError(
      `Pipeline failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      diagnostics
    );
  }
}

// ============ Step Runner with Retry ============

interface RunStepParams<T> {
  stepName: StepDiagnostic['step'];
  promptBuilder: (previousIssues?: string[]) => string;
  validator: (output: T) => ValidationResult;
  diagnostics: V3Diagnostics;
}

async function runStep<T>(params: RunStepParams<T>): Promise<T> {
  const { stepName, promptBuilder, validator, diagnostics } = params;
  
  let lastError: Error | null = null;
  let lastValidationIssues: string[] = [];

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const stepStart = Date.now();
    
    try {
      // Pass previous issues on retry
      const prompt = promptBuilder(attempt > 0 ? lastValidationIssues : undefined);
      
      const response = await callClaude({
        model: MODEL,
        messages: [{ role: 'user', content: prompt }],
        maxTokens: 4096,
      });

      const output = parseJsonResponse<T>(response.content);
      const validation = validator(output);

      const stepDiagnostic: StepDiagnostic = {
        step: stepName,
        status: validation.valid ? 'success' : 'retry',
        durationMs: Date.now() - stepStart,
        inputTokens: response.usage.inputTokens,
        outputTokens: response.usage.outputTokens,
        cost: calculateCost(response.usage),
        retryCount: attempt,
        validationIssues: validation.issues.length > 0 ? validation.issues : undefined,
      };

      if (validation.valid) {
        diagnostics.steps.push(stepDiagnostic);
        return output;
      }

      // Store issues for retry
      lastValidationIssues = validation.issues;

      // Validation failed
      if (!validation.canRetry || attempt === MAX_RETRIES) {
        stepDiagnostic.status = 'failed';
        diagnostics.steps.push(stepDiagnostic);
        throw new StepValidationError(stepName, validation.issues);
      }

      // Log retry
      diagnostics.warnings.push(
        `${stepName}: Retry ${attempt + 1} due to: ${validation.issues.join(', ')}`
      );
      diagnostics.steps.push(stepDiagnostic);

    } catch (error) {
      if (error instanceof StepValidationError) throw error;
      
      lastError = error instanceof Error ? error : new Error(String(error));
      
      if (attempt === MAX_RETRIES) {
        diagnostics.steps.push({
          step: stepName,
          status: 'failed',
          durationMs: Date.now() - stepStart,
          inputTokens: 0,
          outputTokens: 0,
          cost: 0,
          retryCount: attempt,
          validationIssues: [lastError.message],
        });
        throw lastError;
      }
    }
  }

  throw lastError || new Error(`${stepName} failed after ${MAX_RETRIES} retries`);
}

// ============ Helpers ============

function updateAggregates(state: AccumulatedState): void {
  state.allUsedBaseIds = [
    ...state.chUsedBaseIds,
    ...state.p1UsedBaseIds,
    ...state.p2UsedBaseIds,
  ];
  state.allUsedVerbs = [
    ...new Set([
      ...state.summaryVerbs,
      ...state.chUsedVerbs,
      ...state.p1UsedVerbs,
      ...state.p2UsedVerbs,
    ])
  ];
  state.allUsedMetrics = [
    ...new Set([
      ...state.summaryMetrics,
      ...state.chUsedMetrics,
      ...state.p1UsedMetrics,
    ])
  ];
}

function parseJsonResponse<T>(content: string): T {
  const cleaned = content
    .replace(/```json\n?/g, '')
    .replace(/```\n?/g, '')
    .trim();
  
  return JSON.parse(cleaned) as T;
}

function calculateCost(usage: { inputTokens: number; outputTokens: number }): number {
  // Sonnet pricing: $3/1M input, $15/1M output
  const inputCost = (usage.inputTokens / 1_000_000) * 3;
  const outputCost = (usage.outputTokens / 1_000_000) * 15;
  return inputCost + outputCost;
}

// ============ Errors ============

export class V3PipelineError extends Error {
  constructor(message: string, public diagnostics: V3Diagnostics) {
    super(message);
    this.name = 'V3PipelineError';
  }
}

export class StepValidationError extends Error {
  constructor(public step: string, public issues: string[]) {
    super(`${step} validation failed: ${issues.join(', ')}`);
    this.name = 'StepValidationError';
  }
}
```

---

## Validators

```typescript
// src/lib/v3/validators.ts

import { AccumulatedState, ValidationResult } from './types';

export function validateJDOutput(output: any): ValidationResult {
  const issues: string[] = [];

  if (!output.metadata?.company) issues.push('Missing company in metadata');
  if (!output.sections || output.sections.length === 0) issues.push('No sections extracted');
  if (!output.themes || output.themes.length === 0) issues.push('No themes identified');

  for (const section of output.sections || []) {
    if (!section.keyPhrases || section.keyPhrases.length < 3) {
      issues.push(`Section "${section.name}" has fewer than 3 key phrases`);
    }
  }

  return {
    valid: issues.length === 0,
    issues,
    canRetry: true,
  };
}

export function validateSummaryOutput(output: any): ValidationResult {
  const issues: string[] = [];

  const wordCount = output.summary?.wordCount || 0;
  if (wordCount < 140 || wordCount > 160) {
    issues.push(`Summary word count ${wordCount} outside 140-160 range`);
  }

  if (!output.thematicAnchors?.primaryNarrative) {
    issues.push('Missing primaryNarrative in thematicAnchors');
  }

  if (!output.jdMapping || output.jdMapping.length < 3) {
    issues.push('Summary must use at least 3 JD phrases');
  }

  const forbidden = ['leveraged', 'utilized', 'spearheaded', 'synergy', 'passion'];
  const content = (output.summary?.content || '').toLowerCase();
  for (const word of forbidden) {
    if (content.includes(word)) {
      issues.push(`Forbidden word "${word}" in summary`);
    }
  }

  if (output.summary?.content?.includes('â€”')) {
    issues.push('Summary contains emdash (â€”)');
  }

  return {
    valid: issues.length === 0,
    issues,
    canRetry: true,
  };
}

export function validateCHOutput(output: any, state: AccumulatedState): ValidationResult {
  const issues: string[] = [];

  if (output.careerHighlights?.length !== 5) {
    issues.push(`Expected 5 career highlights, got ${output.careerHighlights?.length}`);
  }

  const usedBaseIds = new Set<string>();
  const usedVerbs = new Set<string>();

  for (const ch of output.careerHighlights || []) {
    if (usedBaseIds.has(ch.baseId)) {
      issues.push(`Duplicate base ID: ${ch.baseId}`);
    }
    usedBaseIds.add(ch.baseId);

    const verb = ch.primaryVerb?.toLowerCase();
    if (verb && usedVerbs.has(verb)) {
      issues.push(`Duplicate verb across CHs: ${ch.primaryVerb}`);
    }
    usedVerbs.add(verb);

    if (ch.wordCount < 35 || ch.wordCount > 50) {
      issues.push(`CH ${ch.slot} word count ${ch.wordCount} outside 35-50 range`);
    }

    if (!ch.jdMapping || ch.jdMapping.length < 2) {
      issues.push(`CH ${ch.slot} must have at least 2 JD mappings`);
    }
  }

  return {
    valid: issues.length === 0,
    issues,
    canRetry: issues.length <= 3,
  };
}

export function validateP1Output(output: any, state: AccumulatedState): ValidationResult {
  const issues: string[] = [];

  const ovWordCount = output.overview?.wordCount || 0;
  if (ovWordCount < 40 || ovWordCount > 60) {
    issues.push(`P1 overview word count ${ovWordCount} outside 40-60 range`);
  }

  if (output.bullets?.length !== 4) {
    issues.push(`Expected 4 P1 bullets, got ${output.bullets?.length}`);
  }

  for (const bullet of output.bullets || []) {
    if (bullet.wordCount < 25 || bullet.wordCount > 40) {
      issues.push(`Bullet ${bullet.slot} word count ${bullet.wordCount} outside 25-40 range`);
    }

    if (state.allUsedBaseIds.includes(bullet.baseId)) {
      issues.push(`Bullet ${bullet.slot} uses banned base ID: ${bullet.baseId}`);
    }

    if (state.allUsedVerbs.map(v => v.toLowerCase()).includes(bullet.primaryVerb?.toLowerCase())) {
      issues.push(`Bullet ${bullet.slot} starts with banned verb: ${bullet.primaryVerb}`);
    }
  }

  return {
    valid: issues.length === 0,
    issues,
    canRetry: !issues.some(i => i.includes('banned')),
  };
}

export function validateP2Output(output: any, state: AccumulatedState): ValidationResult {
  const issues: string[] = [];

  // Overview word count
  const ovWordCount = output.overview?.wordCount || 0;
  if (ovWordCount < 40 || ovWordCount > 60) {
    issues.push(`P2 overview word count ${ovWordCount} outside 40-60 range`);
  }

  // Bullet count
  if (output.bullets?.length !== 3) {
    issues.push(`Expected 3 P2 bullets, got ${output.bullets?.length}`);
  }

  const usedVerbs = new Set<string>();

  for (const bullet of output.bullets || []) {
    // Word count
    if (bullet.wordCount < 25 || bullet.wordCount > 40) {
      issues.push(`Bullet ${bullet.slot} word count ${bullet.wordCount} outside 25-40 range`);
    }

    // Banned base IDs
    if (state.allUsedBaseIds.includes(bullet.baseId)) {
      issues.push(`Bullet ${bullet.slot} uses banned base ID: ${bullet.baseId}`);
    }

    // Banned verbs
    if (state.allUsedVerbs.map(v => v.toLowerCase()).includes(bullet.primaryVerb?.toLowerCase())) {
      issues.push(`Bullet ${bullet.slot} starts with banned verb: ${bullet.primaryVerb}`);
    }

    // Verb repetition within P2
    const verb = bullet.primaryVerb?.toLowerCase();
    if (usedVerbs.has(verb)) {
      issues.push(`Duplicate verb within P2: ${bullet.primaryVerb}`);
    }
    usedVerbs.add(verb);

    // patternProof field required for P2
    if (!bullet.patternProof) {
      issues.push(`Bullet ${bullet.slot} missing patternProof field`);
    }
  }

  return {
    valid: issues.length === 0,
    issues,
    canRetry: !issues.some(i => i.includes('banned')),
  };
}
}

export function validateP3P6Output(output: any, state: AccumulatedState): ValidationResult {
  const issues: string[] = [];

  if (output.overviews?.length !== 4) {
    issues.push(`Expected 4 overviews, got ${output.overviews?.length}`);
  }

  const usedVerbs = new Set<string>();

  for (const ov of output.overviews || []) {
    const verb = ov.startingVerb?.toLowerCase();
    
    if (state.allUsedVerbs.map(v => v.toLowerCase()).includes(verb)) {
      issues.push(`Overview P${ov.position} starts with banned verb: ${ov.startingVerb}`);
    }

    if (usedVerbs.has(verb)) {
      issues.push(`Duplicate verb within P3-P6: ${ov.startingVerb}`);
    }
    usedVerbs.add(verb);
  }

  return {
    valid: issues.length === 0,
    issues,
    canRetry: true,
  };
}
```

---


---

## Claude Client

```typescript
// src/lib/v3/claude-client.ts

import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();

interface ClaudeRequest {
  model: string;
  messages: { role: 'user' | 'assistant'; content: string }[];
  maxTokens: number;
}

interface ClaudeResponse {
  content: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
}

export async function callClaude(request: ClaudeRequest): Promise<ClaudeResponse> {
  const response = await client.messages.create({
    model: request.model,
    max_tokens: request.maxTokens,
    messages: request.messages,
  });

  const textBlock = response.content.find(b => b.type === 'text');
  
  return {
    content: textBlock?.text || '',
    usage: {
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    },
  };
}
```

---

## Content Loader

```typescript
// src/lib/v3/content-loader.ts

import { ContentSources, Profile } from './types';

/**
 * TODO: Implement in Session 5
 * 
 * This needs to:
 * 1. Load master-content.json
 * 2. Transform to V3 ContentSources shape
 * 3. Handle variants (CH has them, some bullets don't)
 * 4. Map tags correctly per section type
 * 
 * Current master-content.json structure needs review before implementing.
 */

export async function loadContentSources(): Promise<ContentSources> {
  throw new Error('Not implemented — see Session 5');
}

export async function loadProfile(profileId: string): Promise<Profile> {
  // Hardcoded for now — eventually load from DB
  return {
    header: {
      name: 'Umberto Castaldo',
      targetTitle: 'SVP Brand Strategy',
      location: 'New York, NY',
      phone: '917 435 2003',
      email: 'Umberto.Castaldo@gmail.com',
      linkedin: 'linkedin.com/in/umbertocastaldo',
    },
    positions: [
      { company: 'Deloitte Digital', title: 'SVP Brand Strategy', startDate: 'May 2021', endDate: 'Present', location: 'New York, NY' },
      { company: 'Deloitte Digital', title: 'Sr. Director of Brand Strategy', startDate: 'Apr 2018', endDate: 'May 2021', location: 'New York, NY' },
      { company: 'Omnicom Media Group', title: 'VP of Innovation', startDate: 'May 2016', endDate: 'Apr 2018', location: 'New York, NY' },
      { company: 'OMD Worldwide', title: 'Head of Media Innovation', startDate: 'Apr 2015', endDate: 'May 2016', location: 'New York, NY' },
      { company: 'Straightline International', title: 'Senior Brand Strategist', startDate: 'Jul 2014', endDate: 'Apr 2015', location: 'New York, NY' },
      { company: 'Berlin Cameron, WPP', title: 'Brand Strategist', startDate: 'Jun 2011', endDate: 'Jul 2014', location: 'New York, NY' },
    ],
    education: [
      { institution: 'Marist College', degree: 'Bachelor of Business Administration', field: 'Business Management & Marketing Communications' },
    ],
  };
}
```

## Assembler

```typescript
// src/lib/v3/assembler.ts

import {
  ResumeV3,
  Profile,
  SummaryChatOutput,
  CHChatOutput,
  P1ChatOutput,
  P2ChatOutput,
  P3P6ChatOutput,
  JDAnalyzerOutput,
  V3Diagnostics,
} from './types';

export interface AssemblerInput {
  sessionId: string;
  profile: Profile;
  jdAnalysis: JDAnalyzerOutput;
  summaryOutput: SummaryChatOutput;
  chOutput: CHChatOutput;
  p1Output: P1ChatOutput;
  p2Output: P2ChatOutput;
  p3p6Output: P3P6ChatOutput;
  diagnostics: V3Diagnostics;
}

export function assembleResume(input: AssemblerInput): ResumeV3 {
  const {
    sessionId,
    profile,
    jdAnalysis,
    summaryOutput,
    chOutput,
    p1Output,
    p2Output,
    p3p6Output,
    diagnostics,
  } = input;

  return {
    version: '3.0',
    generatedAt: new Date().toISOString(),
    sessionId,

    targetRole: {
      company: jdAnalysis.metadata.company,
      title: jdAnalysis.metadata.title,
      industry: jdAnalysis.metadata.industry,
    },

    header: {
      name: profile.header.name,
      targetTitle: profile.header.targetTitle,
      location: profile.header.location,
      phone: profile.header.phone,
      email: profile.header.email,
      linkedin: profile.header.linkedin,
    },

    summary: summaryOutput.summary.content,

    careerHighlights: chOutput.careerHighlights.map(ch => ({
      headline: ch.headline,
      content: ch.content,
      sourceId: ch.sourceId,
    })),

    positions: [
      {
        number: 1,
        company: profile.positions[0].company,
        title: profile.positions[0].title,
        location: profile.positions[0].location,
        startDate: profile.positions[0].startDate,
        endDate: profile.positions[0].endDate,
        overview: p1Output.overview.content,
        bullets: p1Output.bullets.map(b => b.content),
      },
      {
        number: 2,
        company: profile.positions[1].company,
        title: profile.positions[1].title,
        location: profile.positions[1].location,
        startDate: profile.positions[1].startDate,
        endDate: profile.positions[1].endDate,
        overview: p2Output.overview.content,
        bullets: p2Output.bullets.map(b => b.content),
      },
      ...p3p6Output.overviews.map((ov, idx) => ({
        number: (3 + idx) as 3 | 4 | 5 | 6,
        company: profile.positions[2 + idx].company,
        title: profile.positions[2 + idx].title,
        location: profile.positions[2 + idx].location,
        startDate: profile.positions[2 + idx].startDate,
        endDate: profile.positions[2 + idx].endDate,
        overview: ov.content,
        bullets: undefined,
      })),
    ],

    education: profile.education.map(edu => ({
      institution: edu.institution,
      degree: edu.degree,
      field: edu.field,
      year: edu.year,
    })),

    metadata: {
      thematicAnchors: summaryOutput.thematicAnchors,
      jdCoverage: {
        sections: p2Output.coverageAnalysis.finalCoverage,
        gaps: p2Output.coverageAnalysis.remainingGaps,
        unusedHighPhrases: p2Output.coverageAnalysis.unusedHighPhrases,
      },
      contentSources: {
        summary: summaryOutput.summary.sourcesUsed,
        careerHighlights: chOutput.careerHighlights.map(ch => ch.sourceId),
        p1Bullets: p1Output.bullets.map(b => b.sourceId),
        p2Bullets: p2Output.bullets.map(b => b.sourceId),
        overviews: [
          p1Output.overview.sourceId,
          p2Output.overview.sourceId,
          ...p3p6Output.overviews.map(ov => ov.sourceId),
        ],
      },
      diagnostics: {
        totalCost: diagnostics.totalCost,
        totalDurationMs: diagnostics.totalDurationMs,
        retryCount: diagnostics.steps.filter(s => s.retryCount > 0).length,
      },
    },
  };
}
```

---

## DOCX Generator

```typescript
// src/lib/v3/docx-generator.ts

import {
  Document,
  Paragraph,
  TextRun,
  AlignmentType,
  TabStopType,
  TabStopPosition,
  convertInchesToTwip,
} from 'docx';
import { ResumeV3 } from './types';

export function generateDocx(resume: ResumeV3): Document {
  return new Document({
    sections: [{
      properties: {
        page: {
          margin: {
            top: convertInchesToTwip(0.5),
            bottom: convertInchesToTwip(0.5),
            left: convertInchesToTwip(0.6),
            right: convertInchesToTwip(0.6),
          },
        },
      },
      children: [
        ...buildHeader(resume.header),
        ...buildSummary(resume.summary),
        ...buildCareerHighlights(resume.careerHighlights),
        ...buildExperience(resume.positions),
        ...buildEducation(resume.education),
      ],
    }],
  });
}

function buildHeader(header: ResumeV3['header']): Paragraph[] {
  return [
    new Paragraph({
      children: [
        new TextRun({
          text: header.name,
          bold: true,
          size: 28,
          font: 'Calibri',
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 100 },
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: header.targetTitle,
          size: 22,
          font: 'Calibri',
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 100 },
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: `${header.location} | ${header.phone} | ${header.email}`,
          size: 20,
          font: 'Calibri',
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
    }),
  ];
}

function buildSummary(summary: string): Paragraph[] {
  return [
    new Paragraph({
      children: [
        new TextRun({
          text: summary,
          size: 20,
          font: 'Calibri',
        }),
      ],
      spacing: { after: 200 },
    }),
  ];
}

function buildCareerHighlights(highlights: ResumeV3['careerHighlights']): Paragraph[] {
  const paragraphs: Paragraph[] = [
    new Paragraph({
      children: [
        new TextRun({
          text: 'CAREER HIGHLIGHTS',
          bold: true,
          size: 22,
          font: 'Calibri',
        }),
      ],
      spacing: { before: 200, after: 100 },
    }),
  ];

  for (const ch of highlights) {
    // Parse content to separate headline from body
    const contentWithoutHeadline = ch.content.replace(/\*\*[^*]+\*\*:\s*/, '');
    
    paragraphs.push(
      new Paragraph({
        children: [
          new TextRun({ text: 'â€¢ ', size: 20, font: 'Calibri' }),
          new TextRun({ text: ch.headline, bold: true, size: 20, font: 'Calibri' }),
          new TextRun({ text: ': ', bold: true, size: 20, font: 'Calibri' }),
          new TextRun({ text: contentWithoutHeadline, size: 20, font: 'Calibri' }),
        ],
        spacing: { after: 80 },
        indent: { left: convertInchesToTwip(0.25), hanging: convertInchesToTwip(0.25) },
      })
    );
  }

  return paragraphs;
}

function buildExperience(positions: ResumeV3['positions']): Paragraph[] {
  const paragraphs: Paragraph[] = [
    new Paragraph({
      children: [
        new TextRun({
          text: 'PROFESSIONAL EXPERIENCE',
          bold: true,
          size: 22,
          font: 'Calibri',
        }),
      ],
      spacing: { before: 200, after: 100 },
    }),
  ];

  for (const pos of positions) {
    paragraphs.push(
      new Paragraph({
        children: [
          new TextRun({ text: pos.title, bold: true, size: 20, font: 'Calibri' }),
          new TextRun({ text: '\t', size: 20 }),
          new TextRun({ text: `${pos.startDate} - ${pos.endDate}`, size: 20, font: 'Calibri' }),
        ],
        tabStops: [{
          type: TabStopType.RIGHT,
          position: TabStopPosition.MAX,
        }],
        spacing: { before: 150 },
      })
    );

    paragraphs.push(
      new Paragraph({
        children: [
          new TextRun({ text: `${pos.company} | ${pos.location}`, size: 20, font: 'Calibri' }),
        ],
        spacing: { after: 80 },
      })
    );

    paragraphs.push(
      new Paragraph({
        children: [
          new TextRun({ text: pos.overview, size: 20, font: 'Calibri' }),
        ],
        spacing: { after: 80 },
      })
    );

    if (pos.bullets) {
      for (const bullet of pos.bullets) {
        paragraphs.push(
          new Paragraph({
            children: [
              new TextRun({ text: 'â€¢ ', size: 20, font: 'Calibri' }),
              new TextRun({ text: bullet, size: 20, font: 'Calibri' }),
            ],
            indent: { left: convertInchesToTwip(0.25), hanging: convertInchesToTwip(0.25) },
            spacing: { after: 60 },
          })
        );
      }
    }
  }

  return paragraphs;
}

function buildEducation(education: ResumeV3['education']): Paragraph[] {
  const paragraphs: Paragraph[] = [
    new Paragraph({
      children: [
        new TextRun({
          text: 'EDUCATION',
          bold: true,
          size: 22,
          font: 'Calibri',
        }),
      ],
      spacing: { before: 200, after: 100 },
    }),
  ];

  for (const edu of education) {
    paragraphs.push(
      new Paragraph({
        children: [
          new TextRun({ 
            text: `${edu.institution}: ${edu.degree} | ${edu.field}`,
            size: 20,
            font: 'Calibri',
          }),
        ],
      })
    );
  }

  return paragraphs;
}
```

---

## Coverage Report

```typescript
// src/lib/v3/coverage-report.ts

import { ResumeV3, JDAnalyzerOutput } from './types';

export interface CoverageReport {
  overall: {
    score: number;
    grade: 'A' | 'B' | 'C' | 'D' | 'F';
  };
  
  sections: {
    name: string;
    coverage: 'Strong' | 'Partial' | 'Gap';
    proofPoints: number;
  }[];
  
  phrases: {
    highUsed: number;
    highTotal: number;
    mediumUsed: number;
    mediumTotal: number;
  };
  
  gaps: {
    requirement: string;
    severity: string;
    notes: string;
  }[];
  
  recommendations: string[];
}

export function generateCoverageReport(
  resume: ResumeV3,
  jdAnalysis: JDAnalyzerOutput
): CoverageReport {
  const { jdCoverage } = resume.metadata;
  
  // Calculate section scores
  const sectionScores = jdCoverage.sections.map(s => {
    if (s.strength === 'Strong') return 1;
    if (s.strength === 'Partial') return 0.5;
    return 0;
  });
  const sectionScore = sectionScores.reduce((a, b) => a + b, 0) / Math.max(sectionScores.length, 1);

  // Calculate phrase usage
  const allHighPhrases = jdAnalysis.sections
    .flatMap(s => s.keyPhrases.filter(p => p.weight === 'HIGH'));
  const allMediumPhrases = jdAnalysis.sections
    .flatMap(s => s.keyPhrases.filter(p => p.weight === 'MEDIUM'));
  
  const unusedHigh = jdCoverage.unusedHighPhrases.length;
  const highUsed = allHighPhrases.length - unusedHigh;
  
  const phraseScore = highUsed / Math.max(allHighPhrases.length, 1);

  // Calculate gap penalty
  const highGaps = jdCoverage.gaps.filter(g => g.severity === 'High').length;
  const gapPenalty = highGaps * 0.1;

  // Overall score
  const rawScore = (sectionScore * 0.5 + phraseScore * 0.4) * 100;
  const finalScore = Math.max(0, Math.min(100, rawScore - gapPenalty * 100));

  // Grade
  const grade = 
    finalScore >= 90 ? 'A' :
    finalScore >= 80 ? 'B' :
    finalScore >= 70 ? 'C' :
    finalScore >= 60 ? 'D' : 'F';

  // Generate recommendations
  const recommendations: string[] = [];
  
  if (unusedHigh > 0) {
    recommendations.push(
      `${unusedHigh} HIGH-weight phrases weren't used: ${jdCoverage.unusedHighPhrases.slice(0, 3).join(', ')}${unusedHigh > 3 ? '...' : ''}`
    );
  }
  
  const gapSections = jdCoverage.sections.filter(s => s.strength === 'Gap');
  if (gapSections.length > 0) {
    recommendations.push(
      `JD sections with gaps: ${gapSections.map(s => s.section).join(', ')}`
    );
  }

  for (const gap of jdCoverage.gaps.filter(g => g.severity === 'High')) {
    recommendations.push(`High-risk gap: ${gap.gap}`);
  }

  return {
    overall: { score: Math.round(finalScore), grade },
    sections: jdCoverage.sections.map(s => ({
      name: s.section,
      coverage: s.strength,
      proofPoints: s.coveredBy.length,
    })),
    phrases: {
      highUsed,
      highTotal: allHighPhrases.length,
      mediumUsed: 0, // Would need to calculate from all jdMappings
      mediumTotal: allMediumPhrases.length,
    },
    gaps: jdCoverage.gaps.map(g => ({
      requirement: g.gap,
      severity: g.severity,
      notes: g.notes,
    })),
    recommendations,
  };
}
```

---

## File Structure

```
src/lib/v3/
├── index.ts                 # Main entry point (generateResumeV3)
├── orchestrator.ts          # Pipeline runner
├── assembler.ts             # Resume assembly
├── docx-generator.ts        # DOCX output
├── coverage-report.ts       # JD coverage analysis
├── types.ts                 # All V3 types
├── validators.ts            # Output validation
├── claude-client.ts         # Claude API wrapper
├── content-loader.ts        # Content source loader (placeholder until Session 5)
├── prompts/
│   ├── jd-analyzer.ts
│   ├── summary-chat.ts
│   ├── ch-chat.ts
│   ├── p1-chat.ts
│   ├── p2-chat.ts
│   └── p3p6-chat.ts
└── __tests__/
    ├── orchestrator.test.ts
    ├── validators.test.ts
    └── assembler.test.ts
```
```

---

## Implementation Sessions

### Session 1: Foundation (~60 min)

**Deliverables:**
- `src/lib/v3/types.ts` â€” All TypeScript types
- `src/lib/v3/validators.ts` â€” All validation functions
- Unit tests for validators

**Commit:** `feat(v3): add types and validators`

---

### Session 2: JD Analyzer + Summary (~90 min)

**Deliverables:**
- `src/lib/v3/prompts/jd-analyzer.ts`
- `src/lib/v3/prompts/summary-chat.ts`
- Manual test with Bankrate JD

**Commit:** `feat(v3): add JD analyzer and summary chat prompts`

---

### Session 3: CH + P1 Prompts (~90 min)

**Deliverables:**
- `src/lib/v3/prompts/ch-chat.ts`
- `src/lib/v3/prompts/p1-chat.ts`
- Manual test with Bankrate JD

**Commit:** `feat(v3): add CH and P1 chat prompts`

---

### Session 4: P2 + P3-P6 Prompts (~60 min)

**Deliverables:**
- `src/lib/v3/prompts/p2-chat.ts`
- `src/lib/v3/prompts/p3p6-chat.ts`
- Manual test with Bankrate JD

**Commit:** `feat(v3): add P2 and P3-P6 chat prompts`

---

### Session 5: Orchestrator + Content Loader (~120 min)

**Deliverables:**
- `src/lib/v3/orchestrator.ts`
- `src/lib/v3/content-loader.ts` — **Full implementation** (transform master-content.json to V3 types)
- Integration test with Bankrate JD

**Pre-work:** Review master-content.json structure before session. The content loader needs to:
1. Parse summaries (simple: id, label, content, emphasis)
2. Parse career highlights with variants (base + V1-V8 variants)
3. Parse P1/P2 bullets with variants and type field
4. Parse P3-P6 overviews (may be sparse or missing)
5. Handle missing/optional fields gracefully

**Key complexity:** CHs and bullets have different variant structures. Master-content may have evolved since original design. Allocate time for data shape investigation.

**Commit:** `feat(v3): add orchestrator with retry logic and content loader`
---

### Session 6: Assembler + DOCX (~60 min)

**Deliverables:**
- `src/lib/v3/assembler.ts`
- `src/lib/v3/docx-generator.ts`
- `src/lib/v3/coverage-report.ts`
- `src/lib/v3/index.ts`

**Commit:** `feat(v3): add assembler and DOCX generator`

---

### Session 7: API + UI (~90 min)

**Deliverables:**
- `/api/v3/generate` route
- UI toggle for V2.1 vs V3
- Diagnostics display

**Commit:** `feat(v3): add API route and UI integration`

---

### Session 8: Testing + Polish (~60 min)

**Deliverables:**
- Test with 3 different JDs
- Compare V3 vs V2.1 output
- Fix any quality issues

**Commit:** `test(v3): add integration tests and quality fixes`

---

## Quick Start Prompt for Claude Code

```
I'm implementing ResumeOS V3. Read the implementation spec:

1. Search project knowledge for "RESUMEOS_V3_IMPLEMENTATION" 
2. Review the existing V2.1 codebase structure
3. Start with Session 1: Create types.ts and validators.ts

Key files to reference:
- src/lib/prompts/ (existing prompt patterns)
- src/types/ (existing type patterns)  
- src/data/master-content.json (content structure)

Let me know when you've reviewed and are ready to implement Session 1.
```

---

## Appendix: Voice Guide Reference

The prompts reference `UMBERTO_VOICE_GUIDE` and `UMBERTO_VOICE_GUIDE_CONDENSED`. These should be imported from:

```typescript
// src/lib/voice-guide.ts

export const UMBERTO_VOICE_GUIDE = `
## VOICE & PERSONALITY

Write as a confident, senior executive who:
- States accomplishments directly without hedging
- Uses active voice and strong verbs
- Backs claims with specific metrics
- Shows strategic thinking, not just execution
- Has a clear point of view on brand/marketing

## FORBIDDEN WORDS

Never use: Leveraged, Utilized, Spearheaded, Synergy, Passionate, Dynamic, 
Results-driven, Self-starter, Team player, Responsible for, Assisted with

## FORMATTING RULES

- No emdashes (â€”), use commas or periods instead
- No exclamation points
- Bold headlines for Career Highlights: **Headline**: Description
- Metrics should be specific: "$727M" not "significant revenue"
- Client names when source includes them

## WORD COUNT TARGETS

- Summary: 140-160 words
- Career Highlights: 35-50 words each
- P1/P2 Overview: 40-60 words
- P1/P2 Bullets: 25-40 words each
- P3-P6 Overview: 20-40 words
`;

export const UMBERTO_VOICE_GUIDE_CONDENSED = `
## VOICE: Confident executive. Active voice. Specific metrics. No hedging.

## FORBIDDEN: Leveraged, Utilized, Spearheaded, Synergy, Passionate, Dynamic, 
Results-driven, Responsible for, emdashes (â€”), exclamation points

## FORMAT: Bold headlines (**Headline**: Description), specific metrics ($727M not "significant")
`;
```
