# ResumeOS V2.1: Two-Phase Writer Architecture

> **For:** Claude Code Implementation  
> **Created:** January 6, 2026  
> **Status:** Ready for Implementation  
> **Supersedes:** V2 Implementation Plan

---

## Executive Summary

V2.1 fixes the critical failures of V2:
- **Hallucinated structure** → Assembler uses DB data
- **Content duplication** → Allocator pre-assigns exclusively  
- **Robotic summary** → Dedicated voice guide
- **Cognitive overload** → Two-phase writing
- **Word repetition** → Cross-phase verb tracking
- **Missing constraints** → No emdashes, word variety checks

**Key Changes from V2:**
| Component | V2 | V2.1 |
|-----------|-----|------|
| Content assignment | Writer chooses from options | Allocator pre-assigns exclusively |
| Writing | One overloaded writer | Two focused phases |
| Structure | Writer generates | Assembler from DB |
| P3-P6 overviews | AI-generated | Static from DB |
| Voice | Generic prompt | Dedicated voice guide |
| Deduplication | Failed | Guaranteed by allocation |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│  EXISTING V2 COMPONENTS (unchanged)                         │
├─────────────────────────────────────────────────────────────┤
│  JD Strategist → Content Selector → Gap Analyzer            │
│                                                             │
│  [User Intervention Point]                                  │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  NEW: CONTENT ALLOCATOR (Code)                              │
│  ─────────────────────────────────────────────────────────  │
│  Input: Selected content (with candidates per slot)         │
│  Output: Exclusive slot assignments                         │
│                                                             │
│  Rules:                                                     │
│  - Each base content ID → exactly ONE slot                  │
│  - CH slots allocated first (highest value)                 │
│  - P1 bullets can't use CH content or variants              │
│  - P2 bullets can't use CH or P1 content                    │
│  - Summary sources separate pool (never used elsewhere)     │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  PHASE 1: NARRATIVE WRITER (LLM)                            │
│  ─────────────────────────────────────────────────────────  │
│  Writes: Summary + 5 Career Highlights                      │
│  Input: ~2,500 tokens                                       │
│  Output: Content + usedVerbs[] + thematicAnchors{}          │
│  Focus: Voice, personality, strategic positioning           │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  PHASE 2: DETAIL WRITER (LLM)                               │
│  ─────────────────────────────────────────────────────────  │
│  Writes: P1 overview + 4 bullets, P2 overview + 3 bullets   │
│  Input: ~2,000 tokens (includes bannedVerbs from Phase 1)   │
│  Output: Overviews + bullets + usedVerbs[]                  │
│  Focus: Metrics, CAR structure, tactical proof              │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  VALIDATOR (LLM - Enhanced)                                 │
│  ─────────────────────────────────────────────────────────  │
│  Additional checks:                                         │
│  - Word variety (no word > 3x across resume)                │
│  - Emdash detection (fail if any found)                     │
│  - Verb repetition within positions                         │
│  - Summary length (140-160 words)                           │
│  - Metric accuracy against sources                          │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  NEW: ASSEMBLER (Code)                                      │
│  ─────────────────────────────────────────────────────────  │
│  Combines:                                                  │
│  - Header from profile DB (name, contact, target title)     │
│  - Summary from Phase 1                                     │
│  - Career Highlights from Phase 1                           │
│  - P1/P2 structure from positions DB (company, title, dates)│
│  - P1/P2 content from Phase 2                               │
│  - P3-P6 from positions DB (static overviews)               │
│  - Education from profile DB                                │
│                                                             │
│  Output: Complete resume with ZERO hallucination            │
└─────────────────────────────────────────────────────────────┘
```

---

## Component 1: Content Allocator

### Location
- `src/lib/pipeline/content-allocator.ts`

### Purpose
Transforms "candidates per slot" into "exclusive assignment per slot" before any AI writing begins.

### Implementation

```typescript
import { ContentSelectionResult, ContentAllocation, AllocatedSlot } from '@/types/v2.1';

interface AllocationConfig {
  summaryCount: number;      // How many summary sources (2-3)
  chCount: number;           // Career highlights (5)
  p1BulletCount: number;     // Position 1 bullets (4)
  p2BulletCount: number;     // Position 2 bullets (3)
}

const DEFAULT_CONFIG: AllocationConfig = {
  summaryCount: 2,
  chCount: 5,
  p1BulletCount: 4,
  p2BulletCount: 3
};

/**
 * Get the base ID from a variant ID
 * CH-05-V2 → CH-05
 * P1-B08-V1 → P1-B08
 */
function getBaseId(contentId: string): string {
  // Remove variant suffix (-V1, -V2, etc.)
  return contentId.replace(/-V\d+$/, '');
}

/**
 * Check if content is a variant of a used base
 */
function isVariantOfUsed(contentId: string, usedBaseIds: Set<string>): boolean {
  const baseId = getBaseId(contentId);
  return usedBaseIds.has(baseId);
}

/**
 * Allocate content exclusively to slots
 * Each piece of content (and its variants) can only be used ONCE
 */
export function allocateContent(
  selection: ContentSelectionResult,
  config: AllocationConfig = DEFAULT_CONFIG
): ContentAllocation {
  const usedBaseIds = new Set<string>();
  const allocation: ContentAllocation = {
    summaries: [],
    careerHighlights: [],
    position1Bullets: [],
    position2Bullets: [],
    position1Overview: null,
    position2Overview: null,
    allocationLog: []
  };

  // 1. Allocate Summaries (separate pool, never conflict with bullets)
  //    Summaries use their own content IDs (SUM-*), not shared with CH/bullets
  for (let i = 0; i < config.summaryCount && i < selection.summaries.length; i++) {
    const source = selection.summaries[i];
    allocation.summaries.push({
      slot: `summary-source-${i + 1}`,
      contentId: source.id,
      content: source.content,
      score: source.score
    });
    allocation.allocationLog.push({
      action: 'assigned',
      slot: `summary-source-${i + 1}`,
      contentId: source.id,
      reason: `Summary source ${i + 1} (score: ${source.score})`
    });
  }

  // 2. Allocate Career Highlights (highest priority, pick first)
  for (let i = 0; i < config.chCount; i++) {
    const candidates = selection.careerHighlights[i] || [];
    const available = candidates.filter(c => !isVariantOfUsed(c.id, usedBaseIds));
    
    if (available.length > 0) {
      const selected = available[0]; // Highest scored available
      const baseId = getBaseId(selected.id);
      
      allocation.careerHighlights.push({
        slot: `ch-${i + 1}`,
        contentId: selected.id,
        content: selected.content,
        score: selected.score
      });
      
      usedBaseIds.add(baseId);
      
      allocation.allocationLog.push({
        action: 'assigned',
        slot: `ch-${i + 1}`,
        contentId: selected.id,
        reason: `Best available (score: ${selected.score})`,
        blockedVariants: candidates.filter(c => c.id !== selected.id).map(c => c.id)
      });
    } else {
      allocation.allocationLog.push({
        action: 'skipped',
        slot: `ch-${i + 1}`,
        contentId: null,
        reason: 'No available candidates (all variants used)'
      });
    }
  }

  // 3. Allocate Position 1 Bullets
  for (let i = 0; i < config.p1BulletCount; i++) {
    const candidates = selection.position1Bullets[i] || [];
    const available = candidates.filter(c => !isVariantOfUsed(c.id, usedBaseIds));
    
    if (available.length > 0) {
      const selected = available[0];
      const baseId = getBaseId(selected.id);
      
      allocation.position1Bullets.push({
        slot: `p1-bullet-${i + 1}`,
        contentId: selected.id,
        content: selected.content,
        score: selected.score
      });
      
      usedBaseIds.add(baseId);
      
      allocation.allocationLog.push({
        action: 'assigned',
        slot: `p1-bullet-${i + 1}`,
        contentId: selected.id,
        reason: `Best available after CH allocation (score: ${selected.score})`
      });
    } else {
      allocation.allocationLog.push({
        action: 'skipped',
        slot: `p1-bullet-${i + 1}`,
        contentId: null,
        reason: 'No available candidates'
      });
    }
  }

  // 4. Allocate Position 2 Bullets
  for (let i = 0; i < config.p2BulletCount; i++) {
    const candidates = selection.position2Bullets[i] || [];
    const available = candidates.filter(c => !isVariantOfUsed(c.id, usedBaseIds));
    
    if (available.length > 0) {
      const selected = available[0];
      const baseId = getBaseId(selected.id);
      
      allocation.position2Bullets.push({
        slot: `p2-bullet-${i + 1}`,
        contentId: selected.id,
        content: selected.content,
        score: selected.score
      });
      
      usedBaseIds.add(baseId);
      
      allocation.allocationLog.push({
        action: 'assigned',
        slot: `p2-bullet-${i + 1}`,
        contentId: selected.id,
        reason: `Best available after CH+P1 allocation (score: ${selected.score})`
      });
    }
  }

  // 5. Allocate Overviews (these don't conflict with bullets)
  if (selection.overviews[1]?.length > 0) {
    allocation.position1Overview = {
      slot: 'p1-overview',
      contentId: selection.overviews[1][0].id,
      content: selection.overviews[1][0].content,
      score: selection.overviews[1][0].score
    };
  }
  
  if (selection.overviews[2]?.length > 0) {
    allocation.position2Overview = {
      slot: 'p2-overview',
      contentId: selection.overviews[2][0].id,
      content: selection.overviews[2][0].content,
      score: selection.overviews[2][0].score
    };
  }

  return allocation;
}
```

---

## Component 2: Voice Guide

### Location
- `src/lib/prompts/voice-guide.ts`

### Purpose
Consistent voice/personality instructions shared across both writer phases.

### Implementation

```typescript
export const UMBERTO_VOICE_GUIDE = `
## Voice Guide: Umberto Castaldo

### Who He Is
Umberto is a brand strategist who believes great marketing solves business problems through culturally relevant narratives. He bridges consulting rigor with creative craft. He's spent 15 years transforming how companies connect with customers—from healthcare systems to sports leagues to consumer brands.

### His Voice
- **Confident but not arrogant**: States outcomes directly, lets results speak
- **Outcomes-focused**: Leads with impact, not process
- **Direct**: No hedging, no filler, no corporate-speak
- **Strategic**: Connects every tactic to business transformation
- **Human**: Writes like a person, not a LinkedIn bot

### Signature Phrases He Uses
- "solving business problems through culturally relevant narratives"
- "intersection of consulting rigor and creative craft"  
- "from customer insight to flawless execution"
- "captivate, convert, and retain"

### Words/Phrases He Would NEVER Use
- "Leveraged" / "Utilized" / "Spearheaded" / "Synergy"
- "Multi-sided marketplace" (unless he actually ran one)
- "Passion for..." / "Excited to..."
- "Seasoned professional" / "Results-driven"
- Any word ending in "-ize" (incentivize, operationalize)

### Formatting Rules
- NEVER use emdashes (—). Use commas or periods instead.
- NEVER use semicolons in bullets
- Bullets are sentences, not fragments
- No exclamation points
- Numbers > 10 as numerals, ≤ 10 as words

### Summary Guidance
The summary should:
- Be 140-160 words (not shorter)
- Open with a distinctive value proposition, NOT "Umberto is..." or "Umberto builds..."
- Include 2-3 proof points relevant to the target role
- Show personality—make someone want to meet him
- End with his philosophy or approach, not a list of skills

### Career Highlight Guidance
Each highlight should:
- Have a bold headline that's specific, not generic
- Tell a mini-story: situation → action → result
- Include at least one specific metric
- Be 35-50 words (not shorter)
- Start with a strong verb (not "Led" or "Managed")

### Bullet Guidance
Each bullet should:
- Be 25-40 words
- Follow CAR structure (Challenge → Action → Result) implicitly
- Include specific metrics from source material
- Start with varied verbs (never repeat within a position)
- Name clients/companies when possible
`;
```

---

## Component 3: Phase 1 Narrative Writer

### Location
- `src/lib/agents/narrative-writer.ts`
- `src/lib/prompts/narrative-writer-prompt.ts`

### Purpose
Writes Summary + Career Highlights with consistent voice.

### Prompt Template

```typescript
import { JDStrategy, ContentAllocation } from '@/types/v2.1';
import { UMBERTO_VOICE_GUIDE } from './voice-guide';

export function buildNarrativeWriterPrompt(
  strategy: JDStrategy,
  allocation: ContentAllocation
): string {
  return `You are an elite executive resume writer creating the narrative sections of a resume.

${UMBERTO_VOICE_GUIDE}

---

## Target Role

**Company:** ${strategy.company.name}
**Industry:** ${strategy.company.industry}
**Role:** ${strategy.role.title}
**Level:** ${strategy.role.level}

## Positioning Strategy

**Primary Angle:** ${strategy.positioning.primaryAngle.angle}
${strategy.positioning.primaryAngle.contentImplication}

**Supporting Angles:**
${strategy.positioning.supportingAngles.map(a => `- ${a.angle}: ${a.contentImplication}`).join('\n')}

**Narrative Direction:**
${strategy.positioning.narrativeDirection}

## Language to Mirror (naturally, NOT keyword stuffing)
${strategy.language.termsToMirror.slice(0, 5).map(t => `- "${t.jdTerm}" → ${t.naturalUsage}`).join('\n')}

---

## SOURCE MATERIAL

### For Summary (synthesize these into ONE 140-160 word summary)
${allocation.summaries.map(s => `[${s.contentId}]\n${s.content}`).join('\n\n')}

### For Career Highlights (reframe each into a highlight)

${allocation.careerHighlights.map((ch, i) => `**Career Highlight ${i + 1}** [Source: ${ch.contentId}]
${ch.content}`).join('\n\n')}

---

## YOUR TASK

Write:
1. **Summary** (140-160 words) — Fresh, with personality. NOT a copy of source material.
2. **5 Career Highlights** — Each reframed for this specific role. Bold headline + 35-50 word description.

## OUTPUT FORMAT

Return ONLY valid JSON:

{
  "summary": {
    "content": "The complete summary paragraph, 140-160 words",
    "wordCount": 150,
    "sourcesUsed": ["SUM-XX", "SUM-YY"]
  },
  "careerHighlights": [
    {
      "slot": "ch-1",
      "headline": "Bold Headline Here",
      "content": "Full highlight with **Bold Headline**: description...",
      "sourceId": "CH-XX-VY",
      "primaryVerb": "Architected"
    }
  ],
  "metadata": {
    "usedVerbs": ["Architected", "Transformed", "Built", "Drove", "Established"],
    "thematicAnchors": {
      "primaryNarrative": "One sentence describing the throughline",
      "distinctiveValue": "What makes this candidate unique",
      "keyProofPoints": ["metric 1", "metric 2"],
      "toneEstablished": "Description of tone used"
    }
  }
}

## CRITICAL CONSTRAINTS

1. Summary MUST be 140-160 words. Count them.
2. Each highlight MUST be 35-50 words.
3. NO emdashes (—) anywhere. Use commas or periods.
4. NO repeated verbs across all 5 highlights.
5. Every metric must come EXACTLY from source material.
6. Headlines must be specific to the achievement, not generic.
7. DO NOT mention "$15M to $40M practice" unless this is a consulting role.

Return ONLY the JSON object.`;
}
```

### Agent Implementation

```typescript
import { BaseAgent } from './base-agent';
import { JDStrategy, ContentAllocation, NarrativeWriterOutput } from '@/types/v2.1';
import { buildNarrativeWriterPrompt } from '../prompts/narrative-writer-prompt';
import { AGENT_CONFIG } from './config';

interface NarrativeWriterInput {
  strategy: JDStrategy;
  allocation: ContentAllocation;
}

export class NarrativeWriterAgent extends BaseAgent<NarrativeWriterInput, NarrativeWriterOutput> {
  constructor() {
    super('Narrative Writer');
  }

  buildPrompt(input: NarrativeWriterInput): string {
    return buildNarrativeWriterPrompt(input.strategy, input.allocation);
  }

  parseResponse(response: string): NarrativeWriterOutput {
    return this.parseJSON<NarrativeWriterOutput>(response);
  }

  protected getMaxTokens(): number {
    return AGENT_CONFIG.maxTokens.narrativeWriter; // 3000
  }
}
```

---

## Component 4: Phase 2 Detail Writer

### Location
- `src/lib/agents/detail-writer.ts`
- `src/lib/prompts/detail-writer-prompt.ts`

### Purpose
Writes Position 1 and Position 2 content (overviews + bullets).

### Prompt Template

```typescript
import { JDStrategy, ContentAllocation, NarrativeWriterOutput } from '@/types/v2.1';
import { UMBERTO_VOICE_GUIDE } from './voice-guide';

export function buildDetailWriterPrompt(
  strategy: JDStrategy,
  allocation: ContentAllocation,
  phase1Output: NarrativeWriterOutput
): string {
  return `You are an elite executive resume writer creating the position detail sections.

${UMBERTO_VOICE_GUIDE}

---

## Context from Phase 1

The summary and career highlights have established:
- **Primary Narrative:** ${phase1Output.metadata.thematicAnchors.primaryNarrative}
- **Distinctive Value:** ${phase1Output.metadata.thematicAnchors.distinctiveValue}
- **Key Proof Points Already Used:** ${phase1Output.metadata.thematicAnchors.keyProofPoints.join(', ')}
- **Tone:** ${phase1Output.metadata.thematicAnchors.toneEstablished}

## BANNED VERBS (already used in Career Highlights)
DO NOT use any of these verbs: ${phase1Output.metadata.usedVerbs.join(', ')}

---

## Target Role

**Company:** ${strategy.company.name}
**Role:** ${strategy.role.title}

## Language to Mirror
${strategy.language.termsToMirror.slice(0, 3).map(t => `- "${t.jdTerm}"`).join('\n')}

---

## SOURCE MATERIAL

### Position 1 Overview [Source: ${allocation.position1Overview?.contentId}]
${allocation.position1Overview?.content || 'No overview source provided'}

### Position 1 Bullets
${allocation.position1Bullets.map((b, i) => `**P1-Bullet-${i + 1}** [Source: ${b.contentId}]
${b.content}`).join('\n\n')}

### Position 2 Overview [Source: ${allocation.position2Overview?.contentId}]
${allocation.position2Overview?.content || 'No overview source provided'}

### Position 2 Bullets
${allocation.position2Bullets.map((b, i) => `**P2-Bullet-${i + 1}** [Source: ${b.contentId}]
${b.content}`).join('\n\n')}

---

## YOUR TASK

Write:
1. **Position 1 Overview** — 40-60 words, sets context for the role
2. **Position 1 Bullets (4)** — 25-40 words each, metrics-driven
3. **Position 2 Overview** — 40-60 words
4. **Position 2 Bullets (3)** — 25-40 words each, metrics-driven

## OUTPUT FORMAT

Return ONLY valid JSON:

{
  "position1": {
    "overview": {
      "content": "Overview paragraph",
      "sourceId": "OV-P1-XX",
      "wordCount": 50
    },
    "bullets": [
      {
        "slot": "p1-bullet-1",
        "content": "Bullet text with metrics",
        "sourceId": "P1-BXX-VY",
        "primaryVerb": "Unified",
        "wordCount": 32
      }
    ]
  },
  "position2": {
    "overview": {
      "content": "Overview paragraph",
      "sourceId": "OV-P2-XX",
      "wordCount": 45
    },
    "bullets": [
      {
        "slot": "p2-bullet-1",
        "content": "Bullet text with metrics",
        "sourceId": "P2-BXX-VY",
        "primaryVerb": "Developed",
        "wordCount": 35
      }
    ]
  },
  "metadata": {
    "usedVerbs": ["Unified", "Developed", "Crafted", "Orchestrated", "Pioneered", "Launched", "Integrated"]
  }
}

## CRITICAL CONSTRAINTS

1. Bullets MUST be 25-40 words. Count them.
2. Overviews MUST be 40-60 words.
3. NO emdashes (—) anywhere.
4. DO NOT use banned verbs: ${phase1Output.metadata.usedVerbs.join(', ')}
5. NO repeated verbs within Position 1 OR within Position 2.
6. Every metric must come EXACTLY from source material.
7. Name clients/companies when the source names them.

Return ONLY the JSON object.`;
}
```

---

## Component 5: Enhanced Validator

### Location
- `src/lib/agents/validator.ts` (update existing)
- `src/lib/prompts/validator-prompt.ts` (update existing)

### New Validation Checks

Add these checks to the existing validator:

```typescript
// Add to ValidationResult interface
export interface ValidationResult {
  // ... existing fields ...
  
  // NEW checks
  formatChecks: {
    emdashDetected: {
      passed: boolean;
      locations: string[];  // Where emdashes were found
    };
    wordVariety: {
      passed: boolean;
      overusedWords: { word: string; count: number; locations: string[] }[];
    };
    summaryLength: {
      wordCount: number;
      passed: boolean;  // 140-160 words
    };
    bulletLengths: {
      passed: boolean;
      issues: { location: string; wordCount: number; expected: string }[];
    };
    verbRepetition: {
      passed: boolean;
      issues: { verb: string; positions: string[] }[];
    };
  };
}
```

### Validator Prompt Additions

Add to the validator prompt:

```typescript
## ADDITIONAL FORMAT CHECKS

### Emdash Check
Scan ALL text for emdashes (—). This character is BANNED.
- If found, report locations and fail validation.

### Word Variety Check  
Count occurrences of these commonly overused words:
- "platform", "strategy", "brand", "drove", "built", "led", "across"
- If ANY word appears > 3 times across the entire resume, flag it.

### Summary Length Check
Count words in summary. Must be 140-160. Outside this range = fail.

### Bullet Length Check
Count words in each bullet:
- Career Highlights: 35-50 words
- P1/P2 Bullets: 25-40 words
Flag any outside range.

### Verb Repetition Check
List all primary verbs used:
- No verb should appear more than once within Position 1
- No verb should appear more than once within Position 2
- No verb should appear more than twice across entire resume
```

---

## Component 6: Assembler

### Location
- `src/lib/pipeline/assembler.ts`

### Purpose
Combines AI-written content with DB-sourced structure. Zero hallucination for structural data.

### Implementation

```typescript
import { 
  NarrativeWriterOutput, 
  DetailWriterOutput, 
  ProfileData, 
  AssembledResume 
} from '@/types/v2.1';

interface AssemblerInput {
  profile: ProfileData;           // From database
  narrativeOutput: NarrativeWriterOutput;  // From Phase 1
  detailOutput: DetailWriterOutput;        // From Phase 2
  targetTitle?: string;           // Optional override
}

export function assembleResume(input: AssemblerInput): AssembledResume {
  const { profile, narrativeOutput, detailOutput, targetTitle } = input;

  return {
    header: {
      name: profile.name,                    // From DB
      targetTitle: targetTitle || profile.defaultTitle,  // From DB or override
      location: profile.location,            // From DB
      phone: profile.phone,                  // From DB
      email: profile.email,                  // From DB
    },

    summary: narrativeOutput.summary.content,  // From Phase 1 AI

    careerHighlights: narrativeOutput.careerHighlights.map(ch => ch.content),  // From Phase 1 AI

    positions: [
      // Position 1 - Structure from DB, content from AI
      {
        company: profile.positions[0].company,      // "Deloitte Digital" from DB
        title: profile.positions[0].title,          // "SVP Brand Strategy" from DB
        location: profile.positions[0].location,    // "New York, NY" from DB
        startDate: profile.positions[0].startDate,  // "May 2021" from DB
        endDate: profile.positions[0].endDate,      // "Present" from DB
        overview: detailOutput.position1.overview.content,  // From Phase 2 AI
        bullets: detailOutput.position1.bullets.map(b => b.content)  // From Phase 2 AI
      },
      // Position 2 - Structure from DB, content from AI
      {
        company: profile.positions[1].company,
        title: profile.positions[1].title,
        location: profile.positions[1].location,
        startDate: profile.positions[1].startDate,
        endDate: profile.positions[1].endDate,
        overview: detailOutput.position2.overview.content,
        bullets: detailOutput.position2.bullets.map(b => b.content)
      },
      // Positions 3-6 - ENTIRELY from DB (no AI)
      ...profile.positions.slice(2).map(p => ({
        company: p.company,
        title: p.title,
        location: p.location,
        startDate: p.startDate,
        endDate: p.endDate,
        overview: p.overview,  // Static from DB
        bullets: []            // No bullets for older positions
      }))
    ],

    education: {
      school: profile.education.school,
      degree: profile.education.degree,
      field: profile.education.field
    },

    // Metadata for diagnostics
    _meta: {
      assembledAt: new Date().toISOString(),
      sourcesUsed: {
        summary: narrativeOutput.summary.sourcesUsed,
        careerHighlights: narrativeOutput.careerHighlights.map(ch => ch.sourceId),
        position1: [
          detailOutput.position1.overview.sourceId,
          ...detailOutput.position1.bullets.map(b => b.sourceId)
        ],
        position2: [
          detailOutput.position2.overview.sourceId,
          ...detailOutput.position2.bullets.map(b => b.sourceId)
        ]
      }
    }
  };
}
```

---

## Component 7: Profile Data Schema

### Location
- `src/types/profile.ts`
- Database table: `profiles` or extend existing user table

### Schema

```typescript
export interface ProfileData {
  id: string;
  name: string;
  email: string;
  phone: string;
  location: string;
  defaultTitle: string;  // Default headline
  
  positions: PositionData[];
  education: EducationData;
  
  // Optional
  linkedIn?: string;
  website?: string;
}

export interface PositionData {
  order: number;         // 1, 2, 3, 4, 5, 6
  company: string;       // "Deloitte Digital"
  title: string;         // "SVP Brand Strategy / Head of Brand Strategy Practice"
  location: string;      // "New York, NY"
  startDate: string;     // "May 2021"
  endDate: string;       // "Present"
  overview: string;      // Static overview (used for P3-P6)
}

export interface EducationData {
  school: string;
  degree: string;
  field: string;
}
```

### Seed Data for Umberto

```typescript
const UMBERTO_PROFILE: ProfileData = {
  id: 'umberto-castaldo',
  name: 'Umberto Castaldo',
  email: 'Umberto.Castaldo@gmail.com',
  phone: '917 435 2003',
  location: 'New York, NY',
  defaultTitle: 'SVP Brand Strategy / Head of Brand Strategy Practice',
  
  positions: [
    {
      order: 1,
      company: 'Deloitte Digital',
      title: 'SVP Brand Strategy / Head of Brand Strategy Practice',
      location: 'New York, NY',
      startDate: 'May 2021',
      endDate: 'Present',
      overview: '' // AI will write this
    },
    {
      order: 2,
      company: 'Deloitte Digital',
      title: 'Sr. Director of Brand Strategy',
      location: 'New York, NY',
      startDate: 'Apr 2018',
      endDate: 'May 2021',
      overview: '' // AI will write this
    },
    {
      order: 3,
      company: 'Omnicom Media Group',
      title: 'VP of Innovation',
      location: 'New York, NY',
      startDate: 'May 2016',
      endDate: 'Apr 2018',
      overview: 'Promoted to lead innovation across brand, technology, and customer experience, helping clients navigate shift from traditional media to integrated, data-driven marketing approaches and performance measurement systems.'
    },
    {
      order: 4,
      company: 'OMD Worldwide',
      title: 'Head of Media Innovation',
      location: 'New York, NY',
      startDate: 'Apr 2015',
      endDate: 'May 2016',
      overview: "Recruited to lead GE's global brand storytelling and innovation strategy, with mandate to position company as leader in emerging media and branded entertainment through integrated campaign development."
    },
    {
      order: 5,
      company: 'Straightline International',
      title: 'Senior Brand Strategist',
      location: 'New York, NY',
      startDate: 'Jul 2014',
      endDate: 'Apr 2015',
      overview: 'Developed foundational brand strategy systems for B2B and industrial clients undergoing transformation, including post-merger integration and portfolio rationalization through comprehensive positioning and value proposition work.'
    },
    {
      order: 6,
      company: 'Berlin Cameron, WPP Cultural Agency',
      title: 'Brand Strategist',
      location: 'New York, NY',
      startDate: 'Jun 2011',
      endDate: 'Jul 2014',
      overview: 'Supported brand positioning and integrated campaign development across consumer, tech, and financial services clients as part of cross-functional creative teams focused on strategic storytelling and performance outcomes.'
    }
  ],
  
  education: {
    school: 'Marist College',
    degree: 'Bachelor of Business Administration',
    field: 'Business Management & Marketing Communications'
  }
};
```

---

## Component 8: Updated Pipeline

### Location
- `src/lib/pipeline/v2.1-pipeline.ts`

### Flow

```typescript
import { V2Pipeline } from './v2-pipeline';
import { allocateContent } from './content-allocator';
import { assembleResume } from './assembler';
import { NarrativeWriterAgent } from '../agents/narrative-writer';
import { DetailWriterAgent } from '../agents/detail-writer';
import { ValidatorAgent } from '../agents/validator';
import { getProfile } from '../db/profile';

export class V21Pipeline extends V2Pipeline {
  
  /**
   * Override the generation phase to use two-phase writing + assembler
   */
  async runGenerationPhase(): Promise<GenerationResult> {
    const session = await this.loadSession();
    
    // 1. Get profile data from DB (NEVER from AI)
    const profile = await getProfile(session.profileId);
    
    // 2. Allocate content exclusively
    const allocation = allocateContent(session.contentSelection);
    this.recordDiagnostics('allocation', { log: allocation.allocationLog });
    
    // 3. Phase 1: Narrative Writer (Summary + Career Highlights)
    await this.updateStatus('writing-narrative');
    const narrativeAgent = new NarrativeWriterAgent();
    const { output: narrativeOutput, diagnostics: narrativeDiag } = await narrativeAgent.run({
      strategy: session.jdStrategy,
      allocation
    });
    this.recordAgentDiagnostics('narrativeWriter', narrativeDiag);
    
    // 4. Phase 2: Detail Writer (P1/P2 overviews + bullets)
    await this.updateStatus('writing-detail');
    const detailAgent = new DetailWriterAgent();
    const { output: detailOutput, diagnostics: detailDiag } = await detailAgent.run({
      strategy: session.jdStrategy,
      allocation,
      phase1Output: narrativeOutput
    });
    this.recordAgentDiagnostics('detailWriter', detailDiag);
    
    // 5. Assemble (code, not AI)
    const assembledResume = assembleResume({
      profile,
      narrativeOutput,
      detailOutput,
      targetTitle: session.targetTitle
    });
    
    // 6. Validate
    await this.updateStatus('validating');
    const validatorAgent = new ValidatorAgent();
    const { output: validation, diagnostics: validatorDiag } = await validatorAgent.run({
      strategy: session.jdStrategy,
      allocation,
      narrativeOutput,
      detailOutput,
      assembledResume
    });
    this.recordAgentDiagnostics('validator', validatorDiag);
    
    // 7. Determine final status
    const finalStatus = validation.overallVerdict === 'fail' ? 'failed' : 'complete';
    
    await this.saveGenerationResults({
      allocation,
      narrativeOutput,
      detailOutput,
      assembledResume,
      validation,
      status: finalStatus
    });
    
    return {
      sessionId: this.sessionId,
      status: finalStatus,
      resume: assembledResume,
      validation
    };
  }
}
```

---

## Type Definitions

### Location
- `src/types/v2.1.ts`

```typescript
// Content Allocation
export interface AllocatedSlot {
  slot: string;
  contentId: string;
  content: string;
  score: number;
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

// Phase 1 Output
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
    thematicAnchors: {
      primaryNarrative: string;
      distinctiveValue: string;
      keyProofPoints: string[];
      toneEstablished: string;
    };
  };
}

// Phase 2 Output
export interface DetailWriterOutput {
  position1: {
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
  };
  position2: {
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
  };
  metadata: {
    usedVerbs: string[];
  };
}

// Assembled Resume
export interface AssembledResume {
  header: {
    name: string;
    targetTitle: string;
    location: string;
    phone: string;
    email: string;
  };
  summary: string;
  careerHighlights: string[];
  positions: {
    company: string;
    title: string;
    location: string;
    startDate: string;
    endDate: string;
    overview: string;
    bullets: string[];
  }[];
  education: {
    school: string;
    degree: string;
    field: string;
  };
  _meta: {
    assembledAt: string;
    sourcesUsed: Record<string, string[]>;
  };
}
```

---

## Implementation Sessions

### Session 11: Foundation + Allocator
**Duration:** 30-45 min

1. Create `src/types/v2.1.ts` with new type definitions
2. Create `src/lib/pipeline/content-allocator.ts`
3. Create `src/types/profile.ts`
4. Seed Umberto's profile data (can be JSON file initially)
5. Write unit tests for allocator

**Test:** Allocator produces exclusive assignments, no duplicate base IDs

**Commit:** `feat(v2.1): add content allocator and profile types`

---

### Session 12: Voice Guide + Narrative Writer
**Duration:** 45-60 min

1. Create `src/lib/prompts/voice-guide.ts`
2. Create `src/lib/prompts/narrative-writer-prompt.ts`
3. Create `src/lib/agents/narrative-writer.ts`
4. Create `src/app/api/v2.1/write-narrative/route.ts`
5. Update `AGENT_CONFIG` with `narrativeWriter` settings

**Test:** Narrative writer produces 140-160 word summary with personality

**Commit:** `feat(v2.1): add narrative writer (Phase 1)`

---

### Session 13: Detail Writer
**Duration:** 30-45 min

1. Create `src/lib/prompts/detail-writer-prompt.ts`
2. Create `src/lib/agents/detail-writer.ts`
3. Create `src/app/api/v2.1/write-detail/route.ts`
4. Verify banned verbs are respected

**Test:** Detail writer uses different verbs than Phase 1

**Commit:** `feat(v2.1): add detail writer (Phase 2)`

---

### Session 14: Enhanced Validator
**Duration:** 30 min

1. Update `src/lib/prompts/validator-prompt.ts` with new checks
2. Update `src/types/v2.1.ts` with new ValidationResult fields
3. Add emdash detection
4. Add word variety check
5. Add strict length checks

**Test:** Validator catches emdashes and word overuse

**Commit:** `feat(v2.1): enhance validator with format checks`

---

### Session 15: Assembler + Pipeline
**Duration:** 45-60 min

1. Create `src/lib/pipeline/assembler.ts`
2. Create `src/lib/pipeline/v2.1-pipeline.ts`
3. Create `src/app/api/v2.1/pipeline/start/route.ts`
4. Create `src/app/api/v2.1/pipeline/generate/route.ts`
5. Wire up full flow

**Test:** Full E2E with Headway JD

**Commit:** `feat(v2.1): add assembler and complete pipeline`

---

### Session 16: UI Updates + Testing
**Duration:** 30-45 min

1. Update `/v2` page to use v2.1 endpoints (or create `/v2.1` page)
2. Run full test with Headway JD
3. Run full test with FanDuel JD
4. Compare output to V1 and V2
5. Fix any issues discovered

**Commit:** `feat(v2.1): integrate UI and complete testing`

---

## Estimated Costs (V2.1)

| Agent | Input Tokens | Output Tokens | Est. Cost |
|-------|--------------|---------------|-----------|
| JD Strategist | 1,200 | 1,600 | $0.14 |
| Gap Analyzer | 4,500 | 2,000 | $0.22 |
| Narrative Writer | 2,500 | 1,500 | $0.15 |
| Detail Writer | 2,000 | 1,200 | $0.12 |
| Validator | 4,000 | 2,000 | $0.21 |
| **Total** | **14,200** | **8,300** | **$0.84** |

*Using Opus pricing: $15/1M input, $75/1M output*

---

## Success Criteria

### Must Pass
- [ ] No hallucinated company names, titles, or dates
- [ ] No content duplicated across sections
- [ ] No emdashes in output
- [ ] Summary is 140-160 words
- [ ] All bullets are 25-40 words
- [ ] No verb repeated within a position
- [ ] Header includes all contact info
- [ ] P3-P6 have correct companies and overviews

### Quality Bar
- [ ] Summary has personality (not robotic)
- [ ] Summary doesn't mention practice-building for non-consulting roles
- [ ] Positioning feels authentic to Umberto
- [ ] Metrics trace to sources
- [ ] Word variety is good (no word > 3x)

---

## Rollback Plan

V2 endpoints remain at `/api/v2/*`
V2.1 endpoints at `/api/v2.1/*`

If V2.1 fails, switch UI back to V2 (or V1).

---

## File Summary

### New Files
```
src/types/v2.1.ts
src/types/profile.ts
src/lib/prompts/voice-guide.ts
src/lib/prompts/narrative-writer-prompt.ts
src/lib/prompts/detail-writer-prompt.ts
src/lib/agents/narrative-writer.ts
src/lib/agents/detail-writer.ts
src/lib/pipeline/content-allocator.ts
src/lib/pipeline/assembler.ts
src/lib/pipeline/v2.1-pipeline.ts
src/app/api/v2.1/pipeline/start/route.ts
src/app/api/v2.1/pipeline/generate/route.ts
src/app/api/v2.1/write-narrative/route.ts
src/app/api/v2.1/write-detail/route.ts
```

### Modified Files
```
src/lib/prompts/validator-prompt.ts
src/lib/agents/config.ts
```

---

*This plan addresses all V2 failures. Start with Session 11.*
