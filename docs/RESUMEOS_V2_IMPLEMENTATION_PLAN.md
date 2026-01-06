# ResumeOS V2: Multi-Agent Architecture Implementation Plan

> **For:** Claude Code Implementation
> **Created:** January 5, 2026
> **Status:** Ready for Implementation

---

## Executive Summary

ResumeOS V2 replaces the current one-shot generation with a **4-agent pipeline** that treats the content library as **source material** (not pre-written output) and writes **fresh content** for each job description.

**Key Insight:** The content library contains facts, metrics, and angles. The writer creates new content constrained to those facts.

**Model:** Claude Opus for all agents (`claude-opus-4-20250514`)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│  AGENT 1: JD Strategist                                     │
│  Model: claude-opus-4-20250514                              │
│  ────────────────────────────────────────────────────────── │
│  Input:  Raw job description                                │
│  Output: Positioning strategy + scoring signals             │
│  Tokens: ~3-4k                                              │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  CONTENT SELECTION (Code)                                   │
│  File: src/lib/content-selector.ts (modified)               │
│  ────────────────────────────────────────────────────────── │
│  Input:  JD Strategy signals                                │
│  Output: Multiple source items PER SLOT                     │
│  No LLM - deterministic scoring                             │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  AGENT 2: Gap Analyzer                                      │
│  Model: claude-opus-4-20250514                              │
│  ────────────────────────────────────────────────────────── │
│  Input:  JD Strategy + Selected Source Material             │
│  Output: Coverage report + emphasis recommendations         │
│  Tokens: ~4-5k                                              │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  ** USER INTERVENTION POINT **                              │
│  ────────────────────────────────────────────────────────── │
│  User reviews gap analysis                                  │
│  Can adjust source selection                                │
│  Can provide additional context                             │
│  Must approve before writing begins                         │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  AGENT 3: Resume Writer                                     │
│  Model: claude-opus-4-20250514                              │
│  ────────────────────────────────────────────────────────── │
│  Input:  JD Strategy + Source Material + Gap Report         │
│          + User Adjustments                                 │
│  Output: Complete resume (freshly written)                  │
│  Tokens: ~8-10k                                             │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  AGENT 4: Validator                                         │
│  Model: claude-opus-4-20250514                              │
│  ────────────────────────────────────────────────────────── │
│  Input:  Source Material + Written Resume + JD Strategy     │
│  Output: Validation report (honesty, coverage, quality)     │
│  Tokens: ~4-5k                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Critical Concept: Source Material Model

**The content library is NOT pre-written output. It is source material.**

| Section | Sources Provided | Writer Output |
|---------|------------------|---------------|
| Summary | 2-3 summaries | 1 fresh summary |
| CH ×5 | 1-3 variants per slot | 5 fresh highlights |
| P1 Overview | 1-2 variants | 1 fresh overview |
| P1 Bullets ×4 | 1-3 variants per slot | 4 fresh bullets |
| P2 Overview | 1-2 variants | 1 fresh overview |
| P2 Bullets ×3 | 1-3 variants per slot | 3 fresh bullets |
| P3-P6 Overviews | 1 each (no variants) | 4 fresh overviews |

**Writer constraints:**
- Every metric MUST come from source material
- Every client name MUST come from source material
- CAN reframe, restructure, combine angles
- CANNOT invent facts

---

## Phase 1: Agent 1 - JD Strategist

### Purpose
Transform raw job description into a positioning strategy that directs the entire pipeline.

### Location
- New file: `src/lib/agents/jd-strategist.ts`
- New prompt: `src/lib/prompts/jd-strategist-prompt.ts`

### Input Schema
```typescript
interface JDStrategistInput {
  jobDescription: string;
  companyName?: string;    // If provided separately
  targetTitle?: string;    // If provided separately
}
```

### Output Schema
```typescript
interface JDStrategy {
  // Company Context
  company: {
    name: string;
    industry: string;
    subIndustry?: string;
    industryKeywords: string[];      // For scoring engine
    competitors?: string[];
    cultureSignals: string[];
    companySpecificLanguage: string[]; // Terms unique to this company/JD
  };
  
  // Role Analysis
  role: {
    title: string;
    level: 'executive' | 'senior' | 'mid' | 'junior';
    function: string;                 // Primary function (brand-strategy, product-marketing, etc.)
    functionKeywords: string[];       // For scoring engine
    scope: string;                    // Team size, budget, geography
    reportsTo?: string;
    keyStakeholders: string[];
  };
  
  // Requirements (for gap analysis)
  requirements: {
    mustHave: Requirement[];
    niceToHave: Requirement[];
  };
  
  // Positioning Strategy (for writer)
  positioning: {
    primaryAngle: PositioningAngle;
    supportingAngles: PositioningAngle[];
    narrativeDirection: string;       // 2-3 sentence strategic direction
  };
  
  // Language Guidance (for writer - NOT keyword stuffing)
  language: {
    termsToMirror: LanguageMapping[];  // JD term → natural usage
    termsToAvoid: string[];            // Competitor names, etc.
    toneGuidance: string;              // Formal, conversational, etc.
  };
  
  // Scoring Signals (for content selection)
  scoringSignals: {
    industries: string[];              // Tags to match
    functions: string[];               // Tags to match
    themes: string[];                  // Tags to match
  };
}

interface Requirement {
  requirement: string;
  category: 'experience' | 'skill' | 'leadership' | 'industry' | 'outcome';
  priority: 'critical' | 'important' | 'preferred';
  jdEvidence: string;                  // Exact quote from JD
}

interface PositioningAngle {
  angle: string;                       // e.g., "Sports entertainment growth strategist"
  jdEvidence: string;                  // Why this angle serves the JD
  contentImplication: string;          // What to emphasize in content
}

interface LanguageMapping {
  jdTerm: string;                      // How JD says it
  naturalUsage: string;                // How to use it naturally
  context: string;                     // When to use this
}
```

### Example Output (FanDuel JD)
```json
{
  "company": {
    "name": "FanDuel",
    "industry": "sports-entertainment",
    "subIndustry": "sports-betting",
    "industryKeywords": ["sportsbook", "gaming", "betting", "sports-entertainment"],
    "cultureSignals": ["fast-paced", "data-driven", "fan-obsessed"],
    "companySpecificLanguage": ["sports calendar", "key sports moments", "bettors"]
  },
  "role": {
    "title": "Head of Brand Strategy",
    "level": "executive",
    "function": "brand-strategy",
    "functionKeywords": ["brand-strategy", "integrated-campaign", "go-to-market"],
    "scope": "Lead brand strategy function, cross-functional leadership",
    "keyStakeholders": ["CMO", "Product", "Creative", "Media"]
  },
  "requirements": {
    "mustHave": [
      {
        "requirement": "Experience driving fan/customer acquisition at scale",
        "category": "outcome",
        "priority": "critical",
        "jdEvidence": "deliver our value proposition to millions of sports fans"
      },
      {
        "requirement": "Integrated campaign leadership",
        "category": "experience",
        "priority": "critical",
        "jdEvidence": "campaigns that captivate, convert, and retain customers"
      }
    ],
    "niceToHave": [
      {
        "requirement": "Sports/entertainment industry experience",
        "category": "industry",
        "priority": "preferred",
        "jdEvidence": "during key sports moments"
      }
    ]
  },
  "positioning": {
    "primaryAngle": {
      "angle": "Sports entertainment growth strategist who drives fan acquisition at scale",
      "jdEvidence": "captivate, convert, and retain customers during key sports moments",
      "contentImplication": "Lead with NWSL work - 50% attendance growth, fan engagement. Frame all consumer work through sports/entertainment lens."
    },
    "supportingAngles": [
      {
        "angle": "Integrated campaign architect",
        "jdEvidence": "integrated marketing campaigns across channels",
        "contentImplication": "Emphasize cross-channel campaign work, not just brand strategy"
      }
    ],
    "narrativeDirection": "Position as someone who understands how to build emotional connections with sports fans and convert that passion into business results. The NWSL work is the centerpiece - it directly mirrors what FanDuel needs."
  },
  "language": {
    "termsToMirror": [
      {
        "jdTerm": "sports calendar",
        "naturalUsage": "aligned campaigns to the sports calendar",
        "context": "When discussing timing/seasonality of campaigns"
      },
      {
        "jdTerm": "fan acquisition",
        "naturalUsage": "fan acquisition" ,
        "context": "Use instead of 'customer acquisition' where appropriate"
      }
    ],
    "termsToAvoid": ["DraftKings", "bet365"],
    "toneGuidance": "Energetic, results-focused, sports-native"
  },
  "scoringSignals": {
    "industries": ["sports-entertainment", "consumer", "media", "gaming"],
    "functions": ["brand-strategy", "integrated-campaign", "growth-marketing", "go-to-market"],
    "themes": ["fan-engagement", "customer-acquisition", "cultural-relevance", "scale"]
  }
}
```

### Prompt Structure
```typescript
// src/lib/prompts/jd-strategist-prompt.ts

export function buildJDStrategistPrompt(input: JDStrategistInput): string {
  return `
# JD Strategist

You are an expert executive recruiter and brand strategist. Your task is to analyze a job description and create a comprehensive positioning strategy.

## Your Output Will Be Used To:
1. **Score content** - Your industry/function/theme signals will filter a content library
2. **Guide a writer** - Your positioning angles will direct how content is written
3. **Check gaps** - Your requirements list will verify coverage
4. **Mirror language** - Your language mappings will make the resume feel native to this JD

## Job Description
<jd>
${input.jobDescription}
</jd>

${input.companyName ? `Company: ${input.companyName}` : ''}
${input.targetTitle ? `Target Title: ${input.targetTitle}` : ''}

## Instructions

Analyze this JD deeply. Extract:

### 1. Company Context
- What industry is this company in?
- What makes this company/industry unique?
- What language do they use that's specific to their domain?

### 2. Role Analysis  
- What level is this role?
- What's the primary function?
- What's the scope (team, budget, geography)?
- Who are the key stakeholders?

### 3. Requirements
For each requirement:
- Categorize it (experience, skill, leadership, industry, outcome)
- Prioritize it (critical, important, preferred)
- Quote the exact JD evidence

Distinguish must-have from nice-to-have. Be strict - only mark as "critical" if the JD clearly emphasizes it.

### 4. Positioning Strategy
This is the most important section. 

**Primary Angle:** The ONE main positioning that will make this resume compelling. What story should we tell?

**Supporting Angles:** 2-3 additional angles that reinforce the primary.

**Narrative Direction:** 2-3 sentences describing how the resume should read. What should the reader feel?

### 5. Language Guidance
- What JD terms should be mirrored (naturally, not stuffed)?
- What terms should be avoided (competitors, etc.)?
- What's the right tone?

### 6. Scoring Signals
Provide tags for filtering a content library:
- industries: What industry tags would match this JD?
- functions: What function tags would match?
- themes: What theme tags would match?

## Output Format
Respond with a JSON object matching this structure:
\`\`\`json
{
  "company": { ... },
  "role": { ... },
  "requirements": { ... },
  "positioning": { ... },
  "language": { ... },
  "scoringSignals": { ... }
}
\`\`\`

Be thorough. This strategy directs everything downstream.
`;
}
```

### Implementation Notes
- Call Anthropic API with `claude-opus-4-20250514`
- Parse JSON response with error handling
- Store in session as `jd_strategy`
- Replace current `analyze-jd/route.ts` logic

---

## Phase 2: Content Selection (Modified)

### Purpose
Select **multiple source items per slot** based on JD Strategy signals.

### Location
- Modify existing: `src/lib/content-selector.ts`

### Key Change: Multiple Sources Per Slot

**Current behavior:** Select 1 best item per slot
**New behavior:** Select 1-3 relevant items per slot as source material

### New Output Schema
```typescript
interface SourceSelection {
  // Slot-based selection
  summary: {
    slot: 'summary';
    sources: SourceItem[];        // 2-3 summaries
    selectionRationale: string;
  };
  
  careerHighlights: {
    slot: `ch_${1|2|3|4|5}`;
    sources: SourceItem[];        // 1-3 variants per CH slot
    selectionRationale: string;
  }[];
  
  position1: {
    overview: {
      slot: 'p1_overview';
      sources: SourceItem[];      // 1-2 overview variants
      selectionRationale: string;
    };
    bullets: {
      slot: `p1_bullet_${1|2|3|4}`;
      sources: SourceItem[];      // 1-3 variants per bullet slot
      selectionRationale: string;
    }[];
  };
  
  position2: {
    overview: {
      slot: 'p2_overview';
      sources: SourceItem[];
      selectionRationale: string;
    };
    bullets: {
      slot: `p2_bullet_${1|2|3}`;
      sources: SourceItem[];
      selectionRationale: string;
    }[];
  };
  
  positions3to6: {
    position: 3 | 4 | 5 | 6;
    overview: {
      slot: `p${3|4|5|6}_overview`;
      sources: SourceItem[];      // Usually just 1 (no variants)
      selectionRationale: string;
    };
  }[];
  
  // Debug info
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

interface SourceItem {
  id: string;                      // e.g., "CH-02-V3"
  baseId: string;                  // e.g., "CH-02"
  variantLabel?: string;           // e.g., "Fan Acquisition"
  content: string;                 // The actual text
  score: number;                   // Selection score
  tags: {
    industry: string[];
    function: string[];
    theme: string[];
  };
}
```

### Selection Logic Changes

```typescript
// src/lib/content-selector.ts

/**
 * V2: Select multiple sources per slot
 */
export async function selectSourceMaterial(
  jdStrategy: JDStrategy
): Promise<SourceSelection> {
  
  const signals = jdStrategy.scoringSignals;
  
  // 1. Score ALL items in library
  const allScores = await scoreAllItems(signals);
  
  // 2. For summaries: pick top 2-3 that score well
  const summaries = selectTopN(
    allScores.filter(s => s.type === 'summary'),
    3,  // Max 3 summaries
    2   // Min 2 summaries
  );
  
  // 3. For career highlights: pick top 5 BASE items
  //    Then for each, include top 1-3 variants
  const chBases = selectTopN(
    allScores.filter(s => s.type === 'career_highlight' && !s.baseId),
    5,
    5
  );
  
  const careerHighlights = chBases.map((base, slotIndex) => {
    const variants = allScores.filter(s => s.baseId === base.id);
    const topVariants = selectTopN(variants, 3, 1);
    
    return {
      slot: `ch_${slotIndex + 1}` as const,
      sources: [base, ...topVariants].map(toSourceItem),
      selectionRationale: generateRationale(base, topVariants, signals)
    };
  });
  
  // 4. Apply CONFLICT_MAP
  //    If CH-02 selected, exclude P2-B08 from bullet selection
  const blockedIds = getBlockedIds(careerHighlights);
  
  // 5. Select P1 bullets (excluding conflicts)
  // ... similar pattern
  
  // 6. Select P2 bullets (excluding conflicts)
  // ... similar pattern
  
  // 7. Select overviews
  // ... similar pattern
  
  return {
    summary: { slot: 'summary', sources: summaries.map(toSourceItem), ... },
    careerHighlights,
    position1: { ... },
    position2: { ... },
    positions3to6: { ... },
    debug: { ... }
  };
}

function selectTopN(
  items: ScoredItem[],
  max: number,
  min: number
): ScoredItem[] {
  const sorted = items.sort((a, b) => b.score - a.score);
  const threshold = sorted[0]?.score * 0.5;  // At least 50% of top score
  
  const selected = sorted.filter((item, index) => {
    if (index < min) return true;           // Always include minimum
    if (index >= max) return false;         // Never exceed max
    return item.score >= threshold;         // Include if above threshold
  });
  
  return selected;
}
```

### CONFLICT_MAP Enforcement
The existing `CONFLICT_MAP` in `src/lib/rules.ts` should be enforced:
- When a CH is selected, its conflicting bullets are blocked
- This prevents using the same metrics twice

```typescript
// Reference from src/data/content-database.json conflictRules
const conflicts = [
  { itemId: "CH-01", conflictsWith: ["P1-B02"], reason: "Both use $40M practice metrics" },
  { itemId: "CH-02", conflictsWith: ["P2-B08"], reason: "Both use NWSL metrics" },
  // ... etc
];
```

---

## Phase 3: Agent 2 - Gap Analyzer

### Purpose
Analyze whether selected source material adequately covers JD requirements.
Provide emphasis recommendations for the writer.

### Location
- New file: `src/lib/agents/gap-analyzer.ts`
- New prompt: `src/lib/prompts/gap-analyzer-prompt.ts`

### Input Schema
```typescript
interface GapAnalyzerInput {
  jdStrategy: JDStrategy;
  sourceSelection: SourceSelection;
}
```

### Output Schema
```typescript
interface GapAnalysis {
  // Overall Assessment
  overallCoverage: {
    score: number;                    // 0-100
    assessment: 'strong' | 'adequate' | 'weak' | 'poor';
    summary: string;                  // 2-3 sentence summary
  };
  
  // Requirement-by-Requirement Coverage
  requirementCoverage: {
    requirement: Requirement;         // From JD Strategy
    coverage: 'fully_covered' | 'partially_covered' | 'not_covered';
    coveringSource: string | null;    // Which source item covers this
    gap: string | null;               // What's missing if partial/not covered
    suggestion: string | null;        // How to address in writing
  }[];
  
  // Emphasis Recommendations (for writer)
  emphasisRecommendations: {
    slotId: string;                   // e.g., "ch_1", "p1_bullet_2"
    sourceId: string;                 // Which source to emphasize from
    recommendation: string;           // What to emphasize
    reason: string;                   // Why this matters for JD
  }[];
  
  // Honest Gaps (things we CAN'T cover)
  honestGaps: {
    requirement: string;
    reason: string;                   // Why source material doesn't cover this
    mitigation: string | null;        // How to soften this gap in writing
  }[];
  
  // Positioning Alignment
  positioningAlignment: {
    primaryAngleSupported: boolean;
    supportingAnglesCovered: string[];
    missingAngles: string[];
    narrativeViability: string;       // Can we tell the story JD Strategy wants?
  };
  
  // Warnings
  warnings: {
    type: 'missing_critical' | 'weak_coverage' | 'positioning_mismatch';
    message: string;
    severity: 'blocker' | 'warning' | 'info';
  }[];
}
```

### Prompt Structure
```typescript
// src/lib/prompts/gap-analyzer-prompt.ts

export function buildGapAnalyzerPrompt(input: GapAnalyzerInput): string {
  return `
# Gap Analyzer

You are an expert resume strategist. Your task is to analyze whether the selected source material adequately covers the job requirements.

## Context

### JD Strategy (What the Job Needs)
<jd_strategy>
${JSON.stringify(input.jdStrategy, null, 2)}
</jd_strategy>

### Selected Source Material (What We Have)
<source_material>
${formatSourceMaterial(input.sourceSelection)}
</source_material>

## Your Tasks

### 1. Coverage Analysis
For each requirement in the JD Strategy:
- Is it fully covered by the source material?
- Is it partially covered?
- Is it not covered at all?

If covered, identify WHICH source item covers it.
If not covered, explain the gap.

### 2. Emphasis Recommendations
Based on the positioning strategy and JD requirements, recommend what to emphasize in each slot.

For example:
- "In CH slot 1 (NWSL), emphasize the fan acquisition angle (from CH-02-V1) rather than the commercial angle (CH-02-V4) because JD prioritizes 'captivate, convert, and retain'"

### 3. Honest Gaps
Identify requirements that CANNOT be covered by the source material.
Be honest - if there's no sports betting experience in the sources, say so.
Suggest how to mitigate (e.g., "Frame general consumer experience through sports lens").

### 4. Positioning Alignment
Can we tell the story the JD Strategy wants?
- Is the primary positioning angle supported by the sources?
- Are the supporting angles covered?
- What's missing?

### 5. Warnings
Flag anything that's a blocker or serious concern:
- Critical requirement not covered
- Positioning angle unsupported
- Source material mismatch

## Output Format
Respond with a JSON object matching this structure:
\`\`\`json
{
  "overallCoverage": { ... },
  "requirementCoverage": [ ... ],
  "emphasisRecommendations": [ ... ],
  "honestGaps": [ ... ],
  "positioningAlignment": { ... },
  "warnings": [ ... ]
}
\`\`\`

Be thorough but honest. Better to flag gaps now than produce a weak resume.
`;
}

function formatSourceMaterial(selection: SourceSelection): string {
  let output = '';
  
  // Format summaries
  output += '## Summary Sources\n';
  selection.summary.sources.forEach(s => {
    output += `### ${s.id}\n${s.content}\n\n`;
  });
  
  // Format career highlights
  output += '## Career Highlight Sources\n';
  selection.careerHighlights.forEach(ch => {
    output += `### Slot: ${ch.slot}\n`;
    ch.sources.forEach(s => {
      output += `#### ${s.id} (${s.variantLabel || 'base'})\n${s.content}\n\n`;
    });
  });
  
  // ... continue for bullets and overviews
  
  return output;
}
```

---

## Phase 4: User Intervention Point

### Purpose
Allow user to review gap analysis and make adjustments before writing.

### Implementation Approach
This is a **UI/UX change** that introduces a new step in the workflow.

### New API Endpoint
```typescript
// src/app/api/review-gaps/route.ts

export async function GET(request: NextRequest) {
  // Return gap analysis for user review
  const { sessionId } = getParams(request);
  
  const session = await getSession(sessionId);
  
  return NextResponse.json({
    jdStrategy: session.jd_strategy,
    sourceSelection: session.source_selection,
    gapAnalysis: session.gap_analysis,
    
    // User can modify:
    allowedActions: {
      swapSource: true,        // Swap a source item for another
      addContext: true,        // Add context for the writer
      skipSlot: true,          // Skip a slot (e.g., reduce to 4 CH)
      approveAndProceed: true  // Continue to writing
    }
  });
}

export async function POST(request: NextRequest) {
  // User submits their adjustments
  const { 
    sessionId,
    action,
    adjustments
  } = await request.json();
  
  if (action === 'swap_source') {
    // User wants to swap a source item
    const { slotId, removeSourceId, addSourceId } = adjustments;
    await swapSourceInSlot(sessionId, slotId, removeSourceId, addSourceId);
    
    // Re-run gap analysis with new selection
    const newGapAnalysis = await runGapAnalyzer(sessionId);
    return NextResponse.json({ gapAnalysis: newGapAnalysis });
  }
  
  if (action === 'add_context') {
    // User adds context for writer
    const { slotId, context } = adjustments;
    await addUserContext(sessionId, slotId, context);
    return NextResponse.json({ success: true });
  }
  
  if (action === 'approve_and_proceed') {
    // User approves - proceed to writing
    const { additionalInstructions } = adjustments;
    await saveUserApproval(sessionId, additionalInstructions);
    
    // Trigger Agent 3 (Writer)
    const resume = await runResumeWriter(sessionId);
    return NextResponse.json({ resume });
  }
}
```

### User Context Schema
```typescript
interface UserAdjustments {
  // Per-slot context
  slotContext: {
    slotId: string;
    additionalContext: string;     // User-provided context
    emphasize: string[];           // Things to emphasize
    deEmphasize: string[];         // Things to downplay
  }[];
  
  // Global instructions
  globalInstructions: string;
  
  // Honest gap acknowledgments
  acknowledgedGaps: string[];      // User acknowledges these can't be covered
}
```

### UI Component
New component: `src/components/resume/GapReview.tsx`

Features:
- Show gap analysis summary
- Per-slot review with source material preview
- Allow source swapping (show alternatives from library)
- Allow adding user context per slot
- Show warnings prominently
- "Approve and Continue" button

---

## Phase 5: Agent 3 - Resume Writer

### Purpose
Write **fresh content** for the entire resume using source material as factual foundation.

### Location
- New file: `src/lib/agents/resume-writer.ts`
- New prompt: `src/lib/prompts/resume-writer-prompt.ts`

### Input Schema
```typescript
interface ResumeWriterInput {
  jdStrategy: JDStrategy;
  sourceSelection: SourceSelection;
  gapAnalysis: GapAnalysis;
  userAdjustments: UserAdjustments;
}
```

### Output Schema
```typescript
interface WrittenResume {
  summary: {
    content: string;
    sourcesUsed: string[];         // Which source IDs informed this
  };
  
  careerHighlights: {
    slotId: string;
    content: string;
    sourcesUsed: string[];
  }[];
  
  positions: {
    position: 1 | 2 | 3 | 4 | 5 | 6;
    company: string;
    title: string;
    dates: string;
    location: string;
    overview: {
      content: string;
      sourcesUsed: string[];
    };
    bullets?: {
      content: string;
      sourcesUsed: string[];
    }[];
  }[];
  
  // Metadata for validation
  writingMetadata: {
    metricsUsed: MetricUsage[];
    clientsReferenced: string[];
    positioningAngleServed: string;
  };
}

interface MetricUsage {
  metric: string;                  // e.g., "50% attendance growth"
  sourceId: string;                // Where it came from
  usedIn: string;                  // Which slot
}
```

### Prompt Structure
```typescript
// src/lib/prompts/resume-writer-prompt.ts

export function buildResumeWriterPrompt(input: ResumeWriterInput): string {
  return `
# Resume Writer

You are an expert executive resume writer. Your task is to write a complete, tailored resume.

## CRITICAL RULES

### Factual Constraint
You are writing **new content**, but every fact must come from the source material:
- ✅ Metrics MUST come from sources (e.g., "50% growth" must appear in a source)
- ✅ Client names MUST come from sources (e.g., "NWSL" must appear in a source)
- ✅ Outcomes MUST come from sources (e.g., "$60M media deal" must appear)
- ❌ You CANNOT invent metrics, clients, or outcomes
- ✅ You CAN reframe, restructure, and combine angles
- ✅ You CAN change verb choices and sentence structure
- ✅ You CAN emphasize certain aspects over others

### Positioning Constraint
Follow the positioning strategy:
- Primary angle: ${input.jdStrategy.positioning.primaryAngle.angle}
- Narrative direction: ${input.jdStrategy.positioning.narrativeDirection}

### Language Constraint
- Mirror JD language where natural (see language mappings)
- Do NOT stuff keywords - readability matters more
- Use semantic alignment over keyword matching

### Quality Rules
- Bullet length: 25-40 words (career highlights), 20-35 words (position bullets)
- Action verb variety: Never repeat a verb within a position, max 2x per resume
- No passive voice to start bullets
- Quantify where sources allow

## JD Strategy
<jd_strategy>
${JSON.stringify(input.jdStrategy, null, 2)}
</jd_strategy>

## Source Material By Slot
<source_material>
${formatSourcesBySlot(input.sourceSelection)}
</source_material>

## Gap Analysis & Emphasis Recommendations
<gap_analysis>
${JSON.stringify(input.gapAnalysis.emphasisRecommendations, null, 2)}
</gap_analysis>

## User Context & Adjustments
<user_adjustments>
${formatUserAdjustments(input.userAdjustments)}
</user_adjustments>

## Your Task

Write fresh content for each slot:

### Summary
- 4-6 sentences
- Lead with positioning angle
- Use sources: ${input.sourceSelection.summary.sources.map(s => s.id).join(', ')}

### Career Highlights (5)
For each slot, write ONE fresh bullet that:
- Draws facts from the provided sources for that slot
- Combines the best angles
- Serves the positioning strategy
- Uses JD language naturally

### Position Overviews (6)
- 2-3 sentences each
- P1 and P2 have themed variants to draw from
- P3-P6 have base content only

### Position Bullets
- P1: 4 bullets
- P2: 3 bullets
- For each, draw from the provided sources for that slot

## Output Format
\`\`\`json
{
  "summary": {
    "content": "...",
    "sourcesUsed": ["SUM-CON", "SUM-PG"]
  },
  "careerHighlights": [
    {
      "slotId": "ch_1",
      "content": "...",
      "sourcesUsed": ["CH-02-V1", "CH-02-V5"]
    },
    ...
  ],
  "positions": [
    {
      "position": 1,
      "company": "Deloitte Digital",
      "title": "SVP, Brand Strategy & Activation",
      "dates": "May 2021 – Present",
      "location": "New York, NY",
      "overview": {
        "content": "...",
        "sourcesUsed": ["OV-P1-CON"]
      },
      "bullets": [
        {
          "content": "...",
          "sourcesUsed": ["P1-B01-V2"]
        },
        ...
      ]
    },
    ...
  ],
  "writingMetadata": {
    "metricsUsed": [
      { "metric": "50% attendance growth", "sourceId": "CH-02", "usedIn": "ch_1" }
    ],
    "clientsReferenced": ["NWSL", "FanDuel"],
    "positioningAngleServed": "Sports entertainment growth strategist"
  }
}
\`\`\`

Write compelling, executive-level content. Every word matters.
`;
}
```

---

## Phase 6: Agent 4 - Validator

### Purpose
Validate the written resume against:
1. **Honesty** - Every fact traceable to source material
2. **Coverage** - JD requirements addressed
3. **Quality** - Writing quality standards met

### Location
- New file: `src/lib/agents/validator.ts`
- New prompt: `src/lib/prompts/validator-prompt.ts`

### Input Schema
```typescript
interface ValidatorInput {
  sourceSelection: SourceSelection;
  writtenResume: WrittenResume;
  jdStrategy: JDStrategy;
}
```

### Output Schema
```typescript
interface ValidationReport {
  // Overall Result
  passed: boolean;
  overallScore: number;            // 0-100
  
  // Honesty Validation
  honesty: {
    score: number;                 // 0-100
    passed: boolean;
    issues: {
      location: string;            // e.g., "ch_1"
      claim: string;               // The problematic claim
      issue: 'metric_not_in_source' | 'client_not_in_source' | 'outcome_fabricated';
      severity: 'blocker' | 'warning';
    }[];
    metricsVerified: {
      metric: string;
      sourceId: string;
      verified: boolean;
    }[];
  };
  
  // Coverage Validation
  coverage: {
    score: number;                 // 0-100
    passed: boolean;
    requirementsAddressed: {
      requirement: string;
      addressed: boolean;
      where: string | null;        // Which slot addresses it
    }[];
    positioningServed: boolean;
  };
  
  // Quality Validation
  quality: {
    score: number;                 // 0-100
    passed: boolean;
    issues: {
      type: 'verb_repetition' | 'bullet_too_long' | 'bullet_too_short' | 
            'passive_voice' | 'weak_verb' | 'missing_quantification';
      location: string;
      detail: string;
      severity: 'blocker' | 'warning' | 'suggestion';
    }[];
    verbUsage: {
      verb: string;
      count: number;
      locations: string[];
    }[];
  };
  
  // Suggested Fixes
  suggestedFixes: {
    location: string;
    issue: string;
    suggestion: string;
    autoFixable: boolean;
  }[];
}
```

### Prompt Structure
```typescript
// src/lib/prompts/validator-prompt.ts

export function buildValidatorPrompt(input: ValidatorInput): string {
  return `
# Resume Validator

You are a rigorous quality assurance expert. Your task is to validate a written resume.

## Validation Criteria

### 1. Honesty Validation (CRITICAL)
Every factual claim must be traceable to source material:
- Every metric (percentages, dollar amounts, counts) must appear in a source
- Every client name must appear in a source
- Every outcome claim must be supported by a source

Flag ANY claim that cannot be traced to source material.

### 2. Coverage Validation
Check if JD requirements are addressed:
- Are critical requirements covered?
- Is the positioning angle served?
- Are there gaps that should have been filled?

### 3. Quality Validation
Check writing quality:
- Verb repetition (max 2x per resume, never within same position)
- Bullet length (CH: 25-40 words, Position: 20-35 words)
- No passive voice at start of bullets
- Strong action verbs

## Source Material (The Truth)
<source_material>
${formatAllSources(input.sourceSelection)}
</source_material>

## Written Resume (To Validate)
<written_resume>
${JSON.stringify(input.writtenResume, null, 2)}
</written_resume>

## JD Requirements (Coverage Check)
<requirements>
${JSON.stringify(input.jdStrategy.requirements, null, 2)}
</requirements>

## Output Format
\`\`\`json
{
  "passed": true/false,
  "overallScore": 0-100,
  "honesty": { ... },
  "coverage": { ... },
  "quality": { ... },
  "suggestedFixes": [ ... ]
}
\`\`\`

Be strict. A fabricated metric is a blocker. A repeated verb is a warning.
`;
}
```

---

## Phase 7: Pipeline Orchestration

### Purpose
Orchestrate the 4 agents + content selection + user intervention.

### Location
- New file: `src/lib/pipeline/v2-pipeline.ts`
- Modified: `src/app/api/generate-resume/route.ts`

### Pipeline States
```typescript
type PipelineState = 
  | 'initial'
  | 'jd_strategy_complete'
  | 'content_selection_complete'
  | 'gap_analysis_complete'
  | 'awaiting_user_approval'      // User intervention point
  | 'user_approved'
  | 'writing_complete'
  | 'validation_complete'
  | 'complete'
  | 'failed';
```

### Session Schema Updates
```sql
-- Add new columns to sessions table
ALTER TABLE sessions ADD COLUMN pipeline_state TEXT DEFAULT 'initial';
ALTER TABLE sessions ADD COLUMN jd_strategy JSONB;
ALTER TABLE sessions ADD COLUMN source_selection JSONB;
ALTER TABLE sessions ADD COLUMN gap_analysis JSONB;
ALTER TABLE sessions ADD COLUMN user_adjustments JSONB;
ALTER TABLE sessions ADD COLUMN written_resume JSONB;
ALTER TABLE sessions ADD COLUMN validation_report JSONB;
ALTER TABLE sessions ADD COLUMN v2_diagnostics JSONB;
```

### Pipeline Orchestrator
```typescript
// src/lib/pipeline/v2-pipeline.ts

export class V2Pipeline {
  private sessionId: string;
  
  constructor(sessionId: string) {
    this.sessionId = sessionId;
  }
  
  async runToUserApproval(): Promise<{
    jdStrategy: JDStrategy;
    sourceSelection: SourceSelection;
    gapAnalysis: GapAnalysis;
  }> {
    // Step 1: JD Strategist
    const jdStrategy = await this.runJDStrategist();
    await this.updateState('jd_strategy_complete', { jd_strategy: jdStrategy });
    
    // Step 2: Content Selection
    const sourceSelection = await selectSourceMaterial(jdStrategy);
    await this.updateState('content_selection_complete', { source_selection: sourceSelection });
    
    // Step 3: Gap Analyzer
    const gapAnalysis = await this.runGapAnalyzer(jdStrategy, sourceSelection);
    await this.updateState('gap_analysis_complete', { gap_analysis: gapAnalysis });
    
    // Step 4: Await user approval
    await this.updateState('awaiting_user_approval');
    
    return { jdStrategy, sourceSelection, gapAnalysis };
  }
  
  async runAfterApproval(userAdjustments: UserAdjustments): Promise<{
    writtenResume: WrittenResume;
    validationReport: ValidationReport;
  }> {
    // Save user adjustments
    await this.updateState('user_approved', { user_adjustments: userAdjustments });
    
    // Get previous state
    const { jdStrategy, sourceSelection, gapAnalysis } = await this.getState();
    
    // Step 5: Resume Writer
    const writtenResume = await this.runResumeWriter(
      jdStrategy, sourceSelection, gapAnalysis, userAdjustments
    );
    await this.updateState('writing_complete', { written_resume: writtenResume });
    
    // Step 6: Validator
    const validationReport = await this.runValidator(
      sourceSelection, writtenResume, jdStrategy
    );
    await this.updateState('validation_complete', { validation_report: validationReport });
    
    // Handle validation failures
    if (!validationReport.passed) {
      // Could implement auto-fix here
      console.warn('Validation failed:', validationReport);
    }
    
    await this.updateState('complete');
    
    return { writtenResume, validationReport };
  }
  
  // ... agent runner methods
}
```

---

## Phase 8: Diagnostics

### Purpose
Full visibility into every pipeline decision.

### Location
- Extend existing: `src/lib/diagnostics.ts`

### Diagnostic Schema
```typescript
interface V2Diagnostics {
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
    jdStrategist: {
      input: JDStrategistInput;
      output: JDStrategy;
      promptSent: string;
      rawResponse: string;
    };
    gapAnalyzer: {
      input: GapAnalyzerInput;
      output: GapAnalysis;
      promptSent: string;
      rawResponse: string;
    };
    resumeWriter: {
      input: ResumeWriterInput;
      output: WrittenResume;
      promptSent: string;
      rawResponse: string;
    };
    validator: {
      input: ValidatorInput;
      output: ValidationReport;
      promptSent: string;
      rawResponse: string;
    };
  };
  
  contentSelection: {
    signals: { industries: string[]; functions: string[]; themes: string[] };
    allScores: ScoreBreakdown[];
    selectedItems: { slotId: string; sourceIds: string[] }[];
    conflictsApplied: string[];
  };
  
  userIntervention: {
    adjustmentsMade: UserAdjustments;
    timeToApproveMs: number;
  };
}
```

### Diagnostic API
```typescript
// GET /api/diagnostics/[sessionId]
// Returns full V2Diagnostics for a session

// Useful for debugging:
// - "Why was CH-03 selected over CH-04?"
// - "What prompt did the writer receive?"
// - "Why did validation fail?"
```

---

## Implementation Order

### Session 1: Foundation
1. Create agent directory structure
2. Set up Opus model configuration
3. Create base types/interfaces
4. Update session schema

### Session 2: Agent 1 - JD Strategist
1. Create prompt file
2. Create agent file
3. Test with FanDuel JD
4. Integrate with API

### Session 3: Content Selection Modification
1. Update `content-selector.ts` for multi-source selection
2. Implement `selectSourceMaterial()`
3. Test source selection
4. Verify conflict handling

### Session 4: Agent 2 - Gap Analyzer
1. Create prompt file
2. Create agent file
3. Test with FanDuel selection
4. Integrate with pipeline

### Session 5: User Intervention Point
1. Create `/api/review-gaps/` endpoint
2. Create `GapReview.tsx` component
3. Wire up to pipeline
4. Test user flow

### Session 6: Agent 3 - Resume Writer
1. Create prompt file
2. Create agent file
3. Test writing with FanDuel
4. Integrate with pipeline

### Session 7: Agent 4 - Validator
1. Create prompt file
2. Create agent file
3. Test validation
4. Integrate with pipeline

### Session 8: Pipeline Orchestration
1. Create `V2Pipeline` class
2. Update `generate-resume/route.ts`
3. Wire all agents together
4. End-to-end testing

### Session 9: Diagnostics & Polish
1. Implement V2 diagnostics
2. Create diagnostics API
3. Polish error handling
4. Performance optimization

---

## Testing Checklist

### Per-Agent Tests
- [ ] JD Strategist extracts correct signals for FanDuel
- [ ] Content Selection returns 2-3 sources per slot
- [ ] Gap Analyzer identifies NWSL as covering fan engagement
- [ ] Gap Analyzer flags missing sports betting experience
- [ ] Writer produces fresh content using only source facts
- [ ] Validator catches any fabricated metrics
- [ ] Validator passes valid resume

### End-to-End Tests
- [ ] FanDuel JD produces sports-focused resume
- [ ] Financial Services JD produces FS-focused resume
- [ ] User can swap source and re-run gap analysis
- [ ] User context affects writer output
- [ ] Validation failures trigger appropriate response
- [ ] Diagnostics capture full pipeline

### Edge Cases
- [ ] JD with no clear industry match
- [ ] JD requiring experience not in library
- [ ] Conflicting sources selected
- [ ] User skips slots
- [ ] Validation fails repeatedly

---

## File Summary

### New Files to Create
```
src/lib/agents/
├── jd-strategist.ts
├── gap-analyzer.ts
├── resume-writer.ts
└── validator.ts

src/lib/prompts/
├── jd-strategist-prompt.ts
├── gap-analyzer-prompt.ts
├── resume-writer-prompt.ts
└── validator-prompt.ts

src/lib/pipeline/
└── v2-pipeline.ts

src/app/api/
└── review-gaps/
    └── route.ts

src/components/resume/
└── GapReview.tsx
```

### Files to Modify
```
src/lib/content-selector.ts      # Multi-source selection
src/lib/diagnostics.ts           # V2 diagnostics
src/app/api/generate-resume/route.ts  # V2 pipeline
src/types/index.ts               # New type definitions
```

### Database Changes
```sql
ALTER TABLE sessions ADD COLUMN pipeline_state TEXT;
ALTER TABLE sessions ADD COLUMN jd_strategy JSONB;
ALTER TABLE sessions ADD COLUMN source_selection JSONB;
ALTER TABLE sessions ADD COLUMN gap_analysis JSONB;
ALTER TABLE sessions ADD COLUMN user_adjustments JSONB;
ALTER TABLE sessions ADD COLUMN written_resume JSONB;
ALTER TABLE sessions ADD COLUMN validation_report JSONB;
ALTER TABLE sessions ADD COLUMN v2_diagnostics JSONB;
```

---

## Model Configuration

All agents use Claude Opus:

```typescript
// src/lib/config.ts
export const AGENT_CONFIG = {
  model: 'claude-opus-4-20250514',
  maxTokens: {
    jdStrategist: 4000,
    gapAnalyzer: 4000,
    resumeWriter: 8000,
    validator: 4000
  }
};
```

---

## Questions for Umbi Before Starting

1. **UI for Gap Review** - Do you want a full-page review or modal overlay?
2. **Source Swapping** - Should user be able to search full library or only see next-best alternatives?
3. **Validation Failures** - Auto-retry with fixes, or return to user?
4. **Cost Tracking** - Should we display estimated cost per generation?
5. **Diagnostics UI** - Should there be a diagnostics viewer in the app, or just API/JSON download?

---

## File Summary

### New Files to Create

```
src/lib/agents/
├── config.ts                    # Agent configuration & cost calculation
├── base-agent.ts                # Base agent class
├── jd-strategist.ts             # Agent 1
├── gap-analyzer.ts              # Agent 2
├── resume-writer.ts             # Agent 3
└── validator.ts                 # Agent 4

src/lib/prompts/
├── jd-strategist-prompt.ts      # Agent 1 prompt
├── gap-analyzer-prompt.ts       # Agent 2 prompt
├── resume-writer-prompt.ts      # Agent 3 prompt
└── validator-prompt.ts          # Agent 4 prompt

src/lib/pipeline/
└── v2-pipeline.ts               # Pipeline orchestrator

src/lib/
└── content-selector-v2.ts       # Modified content selection

src/app/api/v2/
├── analyze-jd/route.ts          # JD analysis endpoint
├── analyze-gaps/route.ts        # Gap analysis endpoint
├── review-gaps/route.ts         # Get gaps for review
├── swap-source/route.ts         # Swap source endpoint
├── approve/route.ts             # User approval endpoint
├── generate/route.ts            # Resume generation endpoint
├── validate/route.ts            # Validation endpoint
├── pipeline/route.ts            # Full pipeline endpoint
└── diagnostics/[sessionId]/route.ts  # Diagnostics endpoint

src/components/resume/v2/
├── GapReview.tsx                # Gap review UI
└── DiagnosticsViewer.tsx        # Diagnostics viewer UI

src/app/diagnostics/
└── [sessionId]/page.tsx         # Diagnostics page

src/types/
└── v2.ts                        # V2 type definitions

src/drizzle/migrations/
└── add_v2_columns.sql           # Database migration
```

### Files to Modify

```
src/drizzle/schema.ts            # Add V2 columns
src/types/index.ts               # Export V2 types
```

---

## Quick Reference: Session-by-Session

| Session | Deliverable | Key Files | Test |
|---------|-------------|-----------|------|
| 1 | Foundation | `types/v2.ts`, `agents/config.ts`, `agents/base-agent.ts`, schema | Types compile |
| 2 | JD Strategist | `agents/jd-strategist.ts`, `prompts/jd-strategist-prompt.ts`, `api/v2/analyze-jd` | FanDuel JD returns sports signals |
| 3 | Content Selection | `content-selector-v2.ts` | Returns 2-3 sources per slot |
| 4 | Gap Analyzer | `agents/gap-analyzer.ts`, `prompts/gap-analyzer-prompt.ts`, `api/v2/analyze-gaps` | Identifies NWSL as covering fan engagement |
| 5 | User Intervention | `GapReview.tsx`, `api/v2/review-gaps`, `api/v2/swap-source`, `api/v2/approve` | Can swap source and approve |
| 6 | Resume Writer | `agents/resume-writer.ts`, `prompts/resume-writer-prompt.ts`, `api/v2/generate` | Produces fresh content |
| 7 | Validator | `agents/validator.ts`, `prompts/validator-prompt.ts`, `api/v2/validate` | Catches fabricated metrics |
| 8 | Pipeline | `pipeline/v2-pipeline.ts`, `api/v2/pipeline` | Full E2E works |
| 9 | Diagnostics | `DiagnosticsViewer.tsx`, `api/v2/diagnostics` | Shows all prompts/responses |

---

## Estimated Costs (Claude Opus)

| Agent | Avg Prompt Tokens | Avg Completion Tokens | Est. Cost |
|-------|-------------------|----------------------|-----------|
| JD Strategist | 2,000 | 2,500 | ~$0.80 |
| Gap Analyzer | 5,000 | 2,500 | ~$0.70 |
| Resume Writer | 8,000 | 4,000 | ~$1.80 |
| Validator | 6,000 | 2,500 | ~$0.75 |
| **Total** | **21,000** | **11,500** | **~$4.05** |

*Opus pricing: $15/1M input, $75/1M output. Actual costs vary by content length.*

---

## Rollback Plan

If V2 has issues, the existing V1 pipeline remains intact:
- V1 endpoints unchanged (`/api/generate-resume`, `/api/analyze-jd`)
- V2 uses separate `/api/v2/*` endpoints
- V2 uses separate database columns
- To switch back: Just use V1 endpoints

---

## Questions Resolved

| Question | Answer |
|----------|--------|
| Gap types | 6 types: Not Covered, Partially Covered, Weak Coverage, Positioning Unsupported, Missing Critical, Language Gap |
| Source swapping | Both variant swapping (same base) and base swapping (different achievement) |
| Validation failures | Return to user with issues (no auto-retry) |
| Cost tracking | Display per-agent and total cost |
| Diagnostics | Full viewer with prompts, responses, parsed output, scoring tables |

---

## Commit History (Expected)

```
feat(v2): foundation - types, config, base agent class, db schema
feat(v2): implement Agent 1 - JD Strategist
feat(v2): implement multi-source content selection
feat(v2): implement Agent 2 - Gap Analyzer
feat(v2): implement user intervention UI - gap review, source swapping, approval
feat(v2): implement Agent 3 - Resume Writer
feat(v2): implement Agent 4 - Validator
feat(v2): implement pipeline orchestration
feat(v2): implement diagnostics viewer
```

---

## Final Notes for Claude Code

1. **Always use `claude-opus-4-20250514`** — Specified in `AGENT_CONFIG`

2. **JSON parsing** — The `parseJSON` helper handles markdown code blocks

3. **Database columns are JSONB** — Stringify before saving, parse after reading

4. **Pipeline state machine** — Enforce state transitions (can't generate before approval)

5. **Diagnostics are verbose** — Store full prompts/responses for debugging

6. **Cost calculation** — Update `AGENT_CONFIG.pricing` if pricing changes

7. **Timeouts** — Writer needs 120s, others 60s. Set `maxDuration` appropriately

8. **Error handling** — Each agent should fail gracefully with useful errors

---

*This plan is ready for implementation. Start with Session 1 and proceed sequentially.*
