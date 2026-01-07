# ResumeOS V3: Implementation Sessions

> **Total Sessions:** 8  
> **Total Estimated Time:** ~11 hours  
> **Date:** January 7, 2026

---

## Overview

| Session | Focus | Time | Key Deliverables |
|---------|-------|------|------------------|
| 1 | Types + Validators | 60 min | `types.ts`, `validators.ts`, unit tests |
| 2 | JD Analyzer + Summary | 90 min | Two prompt builders, manual test |
| 3 | CH + P1 | 90 min | Two prompt builders, manual test |
| 4 | P2 + P3-P6 | 60 min | Two prompt builders, manual test |
| 5 | Orchestrator | 120 min | `orchestrator.ts`, `content-loader.ts`, `claude-client.ts` |
| 6 | Assembler + DOCX | 60 min | `assembler.ts`, `docx-generator.ts`, `coverage-report.ts` |
| 7 | API + UI | 90 min | `/api/v3/generate`, UI toggle |
| 8 | Testing + Polish | 60 min | Test 3 JDs, compare to V2.1, fixes |

---

## Pre-Implementation Setup

Before starting Session 1, ensure:

1. **Project knowledge loaded** — `RESUMEOS_V3_IMPLEMENTATION_FINAL.md` is in Claude Project
2. **Repo cloned** — https://github.com/umberto-castaldo/resumeos
3. **Dependencies installed** — `npm install`
4. **V2.1 working** — Current production code runs without errors

---

# Session 1: Types + Validators

**Time:** 60 minutes  
**Focus:** Foundation types and validation functions

## Claude Code Prompt

```markdown
# Task: Create ResumeOS V3 Types and Validators

## Context
We're implementing ResumeOS V3 — a "chat per section" architecture. This session creates the foundational TypeScript types and validation functions.

## Reference
Search project knowledge for "RESUMEOS_V3_IMPLEMENTATION_FINAL" and read the TypeScript Types section and Validators section.

## Files to Create

### 1. `src/lib/v3/types.ts`

Create all V3 types as specified in the implementation doc. Key interfaces:
- `V3Input`, `V3Result`
- `JDAnalyzerOutput`, `JDSection`, `KeyPhrase`, `JDMetadata`
- `ThematicAnchors`, `JDMappingEntry`
- `SectionCoverage`, `GapEntry`
- `SummaryChatOutput`, `CHChatOutput`, `P1ChatOutput`, `P2ChatOutput`, `P3P6ChatOutput`
- `CHEntry`, `BulletEntry`, `P2BulletEntry`, `OverviewEntry`, `P3P6OverviewEntry`
- `AccumulatedState`
- `V3Diagnostics`, `StepDiagnostic`, `ErrorEntry`
- `ResumeV3`, `ResumeHeader`, `CareerHighlight`, `Position`, `Education`, `ResumeMetadata`
- `SummarySource`, `CHSource`, `BulletSource`, `ContentSources`
- `Profile`, `ProfileHeader`, `ProfilePosition`
- `ValidationResult`

### 2. `src/lib/v3/validators.ts`

Create all validation functions:
- `validateJDOutput(output: any): ValidationResult`
- `validateSummaryOutput(output: any): ValidationResult`
- `validateCHOutput(output: any, state: AccumulatedState): ValidationResult`
- `validateP1Output(output: any, state: AccumulatedState): ValidationResult`
- `validateP2Output(output: any, state: AccumulatedState): ValidationResult`
- `validateP3P6Output(output: any, state: AccumulatedState): ValidationResult`

Key validation rules per the implementation doc:
- JD: Must have company, sections with 3+ phrases, themes
- Summary: 140-160 words, has anchors, 3+ JD phrases, no forbidden words, no emdash
- CH: Exactly 5, no duplicate baseIds, no duplicate verbs, 35-50 words each, 2+ JD mappings
- P1: 40-60 word overview, 4 bullets at 25-40 words, no banned IDs/verbs/metrics
- P2: 40-60 word overview, 3 bullets at 25-40 words, no banned IDs/verbs, patternProof required
- P3-P6: Exactly 4 overviews, 20-40 words, no banned verbs, no verb repetition within

### 3. `src/lib/v3/__tests__/validators.test.ts`

Unit tests for validators:
- Test each validator with valid input → returns `{ valid: true }`
- Test each validator with invalid input → returns specific issues
- Test edge cases (empty arrays, missing fields)

## Validation Steps

After creating files:
1. Run `npx tsc --noEmit src/lib/v3/types.ts` — should pass
2. Run `npx tsc --noEmit src/lib/v3/validators.ts` — should pass
3. Run `npm test src/lib/v3/__tests__/validators.test.ts` — all tests pass

## Do NOT
- Create prompt builders (Session 2-4)
- Create orchestrator (Session 5)
- Modify existing V2.1 files

## Commit
`feat(v3): add types and validators`
```

## Expected Output

```
src/lib/v3/
├── types.ts           (~400 lines)
├── validators.ts      (~200 lines)
└── __tests__/
    └── validators.test.ts (~150 lines)
```

## Validation Checklist

- [ ] `npm run typecheck` passes
- [ ] All validator tests pass
- [ ] Types importable: `import { JDAnalysis, ResumeV3 } from '@/lib/v3/types'`

---

# Session 2: JD Analyzer + Summary Prompts

**Time:** 90 minutes  
**Focus:** First two prompt builders

## Claude Code Prompt

```markdown
# Task: Create JD Analyzer and Summary Chat Prompts

## Context
We're building V3 prompt builders. These functions construct the prompts sent to Claude for each "chat" in the pipeline.

## Reference
Search project knowledge for "RESUMEOS_V3_IMPLEMENTATION_FINAL" and read:
- JD Analyzer Prompt section
- Summary Chat Prompt section
- Voice Guide Reference section (at end)

## Pre-requisites
- Session 1 complete (`src/lib/v3/types.ts` exists)

## Files to Create

### 1. `src/lib/v3/voice-guide.ts`

Export two constants:
- `UMBERTO_VOICE_GUIDE` — Full voice guide (~30 lines)
- `UMBERTO_VOICE_GUIDE_CONDENSED` — Short version (~10 lines)

Contents per the implementation doc appendix.

### 2. `src/lib/v3/prompts/jd-analyzer.ts`

```typescript
export function buildJDAnalyzerPrompt(
  jdText: string,
  previousIssues?: string[]
): string
```

Key elements:
- Retry block if previousIssues provided
- 6-stage analysis instructions (Metadata, Sections, Global Phrases, Themes, Mapping, Gaps)
- Key phrase rules (exact phrases, 2-6 words, HIGH/MEDIUM/LOW weights)
- Output format (JSON schema)
- Quality checklist

### 3. `src/lib/v3/prompts/summary-chat.ts`

```typescript
export function buildSummaryChatPrompt(
  jdAnalysis: JDAnalyzerOutput,
  summaries: SummarySource[],
  profileHeader: ProfileHeader,
  previousIssues?: string[]
): string
```

Key elements:
- Import and use full UMBERTO_VOICE_GUIDE
- Format JD sections, themes, top phrases, gaps from jdAnalysis
- Positioning decision section (4 options: Industry, Capability, Transformation, Philosophy)
- Summary structure guide (Hook, Pattern, How You Work, Philosophy)
- JD phrase integration rules
- Output format with thematicAnchors structure
- Quality checklist

### 4. `src/lib/v3/prompts/index.ts`

Re-export all prompt builders.

## Manual Test

After creating files, test with Bankrate JD:

1. Create a test script `src/lib/v3/__tests__/manual-jd-test.ts`:
```typescript
import { buildJDAnalyzerPrompt } from '../prompts/jd-analyzer';

const BANKRATE_JD = `...paste Bankrate JD here...`;

const prompt = buildJDAnalyzerPrompt(BANKRATE_JD);
console.log('=== JD ANALYZER PROMPT ===');
console.log(prompt);
console.log('=== TOKEN ESTIMATE ===');
console.log(`~${Math.round(prompt.length / 4)} tokens`);
```

2. Run: `npx ts-node src/lib/v3/__tests__/manual-jd-test.ts`
3. Verify prompt looks correct

## Validation Steps

1. `npx tsc --noEmit src/lib/v3/prompts/*.ts` — passes
2. Prompt length is reasonable (JD Analyzer: ~2000 tokens, Summary: ~3000 tokens)
3. All sections from implementation doc are present

## Do NOT
- Call Claude API (that's Session 5)
- Create CH/P1/P2/P3-P6 prompts (Session 3-4)

## Commit
`feat(v3): add JD analyzer and summary chat prompts`
```

## Expected Output

```
src/lib/v3/
├── voice-guide.ts
└── prompts/
    ├── index.ts
    ├── jd-analyzer.ts
    └── summary-chat.ts
```

---

# Session 3: CH + P1 Prompts

**Time:** 90 minutes  
**Focus:** Career Highlights and Position 1 prompt builders

## Claude Code Prompt

```markdown
# Task: Create CH and P1 Chat Prompts

## Context
Building the next two prompt builders for V3. These are more complex because they receive state from previous chats.

## Reference
Search project knowledge for "RESUMEOS_V3_IMPLEMENTATION_FINAL" and read:
- Career Highlights Chat Prompt section
- P1 Chat Prompt section

## Pre-requisites
- Session 1 complete (types.ts)
- Session 2 complete (jd-analyzer.ts, summary-chat.ts)

## Files to Create

### 1. `src/lib/v3/prompts/ch-chat.ts`

```typescript
export function buildCHChatPrompt(
  jdAnalysis: JDAnalyzerOutput,
  chSources: CHSource[],
  summaryOutput: SummaryChatOutput,
  previousIssues?: string[]
): string
```

Key elements:
- Import UMBERTO_VOICE_GUIDE_CONDENSED
- Format JD sections with all phrases and weights
- Format thematic anchors from Summary (doNotRepeat, reinforce)
- Format CH sources grouped by baseId (show base + variants)
- Selection criteria (prioritized: JD Coverage > Industry > Theme > Gap > Metric > Diversity)
- Hard rules (no duplicate baseIds, 2+ HIGH phrases)
- Rewriting instructions (keep metrics exact, 35-50 words, bold headline)
- Output format with jdMapping per CH
- Coverage analysis structure

Helper function needed:
```typescript
function formatCHSources(sources: CHSource[]): string
```

### 2. `src/lib/v3/prompts/p1-chat.ts`

```typescript
export function buildP1ChatPrompt(
  jdAnalysis: JDAnalyzerOutput,
  p1Sources: BulletSource[],
  profilePosition: ProfilePosition,
  summaryOutput: SummaryChatOutput,
  chOutput: CHChatOutput,
  previousIssues?: string[]
): string
```

Key elements:
- Coverage responsibility section (MUST address, REINFORCE, NOT yours)
- Priority phrases (unused HIGH/MEDIUM from JD)
- Banned state (baseIds, verbs, metrics from Summary+CH)
- Thematic anchors reference
- Position context (company, title, dates)
- Overview sources (40-60 words)
- Bullet sources grouped by baseId
- Selection criteria (Gap > Unused Phrases > Metric > Industry > Diversity)
- Hard rules (no banned IDs/verbs/metrics, 2+ HIGH phrases)
- Output format with gapAddressed field per bullet

Helper functions needed:
```typescript
function formatJDCoverageStatus(jdAnalysis, chOutput): string
function formatGapsForP1(jdAnalysis, chOutput): { mustAddress, reinforce, notYours }
function formatPriorityPhrases(jdAnalysis, chOutput): { high, medium }
function formatBannedState(chOutput, summaryOutput): string
function formatOverviews(overviews: BulletSource[]): string
function formatBullets(bullets: BulletSource[]): string
```

## Manual Test

Create test script that builds both prompts with mock data:

```typescript
// src/lib/v3/__tests__/manual-ch-p1-test.ts
import { buildCHChatPrompt } from '../prompts/ch-chat';
import { buildP1ChatPrompt } from '../prompts/p1-chat';
// ... create mock jdAnalysis, summaryOutput, sources

const chPrompt = buildCHChatPrompt(mockJDAnalysis, mockCHSources, mockSummaryOutput);
console.log('CH prompt tokens:', Math.round(chPrompt.length / 4));

const p1Prompt = buildP1ChatPrompt(mockJDAnalysis, mockP1Sources, mockPosition, mockSummaryOutput, mockCHOutput);
console.log('P1 prompt tokens:', Math.round(p1Prompt.length / 4));
```

## Validation Steps

1. `npx tsc --noEmit src/lib/v3/prompts/*.ts` — passes
2. CH prompt ~4000-5000 tokens (includes all CH sources)
3. P1 prompt ~3000-4000 tokens
4. All helper functions produce readable output

## Commit
`feat(v3): add CH and P1 chat prompts`
```

## Expected Output

```
src/lib/v3/prompts/
├── index.ts (updated)
├── jd-analyzer.ts
├── summary-chat.ts
├── ch-chat.ts      (NEW)
└── p1-chat.ts      (NEW)
```

---

# Session 4: P2 + P3-P6 Prompts

**Time:** 60 minutes  
**Focus:** Final prompt builders

## Claude Code Prompt

```markdown
# Task: Create P2 and P3-P6 Chat Prompts

## Context
Building the final two prompt builders. P2 receives state from all prior chats. P3-P6 is simpler (just verbs).

## Reference
Search project knowledge for "RESUMEOS_V3_IMPLEMENTATION_FINAL" and read:
- P2 Chat Prompt section
- P3-P6 Chat Prompt section

## Pre-requisites
- Sessions 1-3 complete

## Files to Create

### 1. `src/lib/v3/prompts/p2-chat.ts`

```typescript
export function buildP2ChatPrompt(
  jdAnalysis: JDAnalyzerOutput,
  p2Sources: BulletSource[],
  profilePosition: ProfilePosition,
  summaryOutput: SummaryChatOutput,
  chOutput: CHChatOutput,
  p1Output: P1ChatOutput,
  previousIssues?: string[]
): string
```

Key elements:
- Merge state from Summary + CH + P1
- Calculate remaining gaps (what CH and P1 didn't cover)
- Find unused JD phrases
- Banned state (all prior baseIds, verbs, metrics)
- Pattern proof focus ("proves P1 wasn't one-off")
- Output format with patternProof field per bullet
- Final coverage analysis (cumulative across entire resume)

Helper functions:
```typescript
function calculateRemainingGaps(jdAnalysis, chOutput, p1Output): { gaps, reinforce, strong }
function findUnusedPhrases(jdAnalysis, summaryOutput, chOutput, p1Output): { high, medium }
```

### 2. `src/lib/v3/prompts/p3p6-chat.ts`

```typescript
export function buildP3P6ChatPrompt(
  jdAnalysis: JDAnalyzerOutput,
  overviewSources: BulletSource[],
  positions: ProfilePosition[],
  allUsedVerbs: string[],
  previousIssues?: string[]
): string
```

Key elements:
- Simpler than other prompts (light JD mapping)
- Banned verbs list (all from prior sections)
- Position context for each of P3, P4, P5, P6
- Overview options per position (or "write fresh" fallback)
- Purpose by position (P3=Bridge, P4=Foundation, P5=Growth, P6=Origin)
- Output format with jdRelevance (optional connection)
- trajectoryNarrative field

### 3. Update `src/lib/v3/prompts/index.ts`

Re-export all 6 prompt builders.

## Manual Test

Build all prompts with mock data and verify token counts:

| Prompt | Expected Tokens |
|--------|-----------------|
| JD Analyzer | ~2,000 |
| Summary | ~3,000 |
| CH | ~4,500 |
| P1 | ~3,500 |
| P2 | ~3,500 |
| P3-P6 | ~1,500 |

## Validation Steps

1. `npx tsc --noEmit src/lib/v3/prompts/*.ts` — passes
2. All 6 prompts can be built without runtime errors
3. P2 shows cumulative state from all prior chats
4. P3-P6 shows all 4 positions with their overview options

## Commit
`feat(v3): add P2 and P3-P6 chat prompts`
```

## Expected Output

```
src/lib/v3/prompts/
├── index.ts (complete)
├── jd-analyzer.ts
├── summary-chat.ts
├── ch-chat.ts
├── p1-chat.ts
├── p2-chat.ts      (NEW)
└── p3p6-chat.ts    (NEW)
```

---

# Session 5: Orchestrator + Content Loader

**Time:** 120 minutes  
**Focus:** Pipeline execution and content loading

## Pre-Work (Before Session)

Review `src/data/master-content.json` structure:
- How are summaries structured?
- How are CHs structured (base + variants)?
- How are bullets structured (P1 vs P2)?
- Are P3-P6 overviews present?

## Claude Code Prompt

```markdown
# Task: Create Orchestrator and Content Loader

## Context
The orchestrator runs all 6 chats in sequence, manages state between them, handles retries, and logs diagnostics. The content loader transforms master-content.json into V3 types.

## Reference
Search project knowledge for "RESUMEOS_V3_IMPLEMENTATION_FINAL" and read:
- Orchestrator section
- Claude Client section
- Content Loader section

## Pre-requisites
- Sessions 1-4 complete (all types and prompts)

## Files to Create

### 1. `src/lib/v3/claude-client.ts`

Simple wrapper around Anthropic SDK:

```typescript
import Anthropic from '@anthropic-ai/sdk';

interface ClaudeRequest {
  model: string;
  messages: { role: 'user' | 'assistant'; content: string }[];
  maxTokens: number;
}

interface ClaudeResponse {
  content: string;
  usage: { inputTokens: number; outputTokens: number };
}

export async function callClaude(request: ClaudeRequest): Promise<ClaudeResponse>
```

### 2. `src/lib/v3/content-loader.ts`

Transform master-content.json to V3 ContentSources:

```typescript
import { ContentSources, Profile } from './types';

export async function loadContentSources(): Promise<ContentSources>
export async function loadProfile(profileId: string): Promise<Profile>
```

**CRITICAL:** Before implementing, examine the actual structure of:
- `src/data/master-content.json`

The loader must handle:
1. Summaries → SummarySource[]
2. Career Highlights with variants → CHSource[] (flatten base + variants)
3. P1 bullets with variants → BulletSource[]
4. P2 bullets with variants → BulletSource[]
5. P3-P6 overviews (may be sparse) → BulletSource[]

Use defensive coding for missing fields.

### 3. `src/lib/v3/orchestrator.ts`

Main pipeline execution:

```typescript
export async function runV3Pipeline(input: V3Input): Promise<V3Result>
```

Key elements:
- Create sessionId (uuid)
- Initialize AccumulatedState
- Load content sources and profile
- Run each step with runStep helper
- Update state after each step
- Handle errors with V3PipelineError

Helper:
```typescript
async function runStep<T>(params: RunStepParams<T>): Promise<T>
```
- Retry up to 2x on validation failure
- Pass previousIssues to prompt builder on retry
- Log diagnostics per step
- Calculate cost (Sonnet: $3/1M input, $15/1M output)

State update helper:
```typescript
function updateAggregates(state: AccumulatedState): void
```

JSON parser helper:
```typescript
function parseJsonResponse<T>(content: string): T
```
- Strip markdown code blocks
- Handle parsing errors

### 4. `src/lib/v3/__tests__/orchestrator.test.ts`

Integration test:
- Mock callClaude to return valid JSON responses
- Verify state accumulates correctly
- Verify diagnostics are populated

## End-to-End Test

Create a test script that runs the full pipeline with Bankrate JD:

```typescript
// src/lib/v3/__tests__/e2e-test.ts
import { runV3Pipeline } from '../orchestrator';

const BANKRATE_JD = `...`;

async function test() {
  const result = await runV3Pipeline({
    jobDescription: BANKRATE_JD,
    profileId: 'default'
  });
  
  console.log('Success:', result.success);
  console.log('Total cost:', result.diagnostics.totalCost);
  console.log('Total time:', result.diagnostics.totalDurationMs);
  console.log('Steps:', result.diagnostics.steps.map(s => `${s.step}: ${s.status}`));
}

test();
```

Run: `npx ts-node src/lib/v3/__tests__/e2e-test.ts`

## Validation Steps

1. `npx tsc --noEmit src/lib/v3/*.ts` — passes
2. Content loader successfully loads master-content.json
3. E2E test completes (may take 2-3 minutes, cost ~$0.50)
4. All 6 steps show "success" status
5. Final coverage report is populated

## Environment

Ensure `ANTHROPIC_API_KEY` is set in environment.

## Commit
`feat(v3): add orchestrator with retry logic and content loader`
```

## Expected Output

```
src/lib/v3/
├── types.ts
├── validators.ts
├── voice-guide.ts
├── claude-client.ts    (NEW)
├── content-loader.ts   (NEW)
├── orchestrator.ts     (NEW)
└── prompts/
    └── ... (6 files)
```

---

# Session 6: Assembler + DOCX

**Time:** 60 minutes  
**Focus:** Resume assembly and document generation

## Claude Code Prompt

```markdown
# Task: Create Assembler, DOCX Generator, and Coverage Report

## Context
The assembler takes all chat outputs and produces the final ResumeV3 object. The DOCX generator creates a downloadable document. The coverage report scores JD coverage.

## Reference
Search project knowledge for "RESUMEOS_V3_IMPLEMENTATION_FINAL" and read:
- Assembler section
- DOCX Generator section
- Coverage Report section

## Pre-requisites
- Session 5 complete (orchestrator works)

## Files to Create

### 1. `src/lib/v3/assembler.ts`

```typescript
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

export function assembleResume(input: AssemblerInput): ResumeV3
```

Maps all outputs to the ResumeV3 structure:
- header from profile
- summary from summaryOutput
- careerHighlights from chOutput (extract headline, content, sourceId)
- positions from p1Output, p2Output, p3p6Output + profile metadata
- education from profile
- metadata (thematicAnchors, jdCoverage, contentSources, diagnostics)

### 2. `src/lib/v3/docx-generator.ts`

```typescript
import { Document } from 'docx';
import { ResumeV3 } from './types';

export function generateDocx(resume: ResumeV3): Document
```

Uses docx library to create:
- Header (name, title, contact)
- Summary paragraph
- Career Highlights section with bold headlines
- Professional Experience with positions, overviews, bullets
- Education section

Helper functions:
- `buildHeader(header): Paragraph[]`
- `buildSummary(summary): Paragraph[]`
- `buildCareerHighlights(highlights): Paragraph[]`
- `buildExperience(positions): Paragraph[]`
- `buildEducation(education): Paragraph[]`

Note: Parse CH content to separate headline from body:
```typescript
const contentWithoutHeadline = ch.content.replace(/\*\*[^*]+\*\*:\s*/, '');
```

### 3. `src/lib/v3/coverage-report.ts`

```typescript
export interface CoverageReport {
  overall: { score: number; grade: 'A' | 'B' | 'C' | 'D' | 'F' };
  sections: { name: string; coverage: string; proofPoints: number }[];
  phrases: { highUsed: number; highTotal: number; mediumUsed: number; mediumTotal: number };
  gaps: { requirement: string; severity: string; notes: string }[];
  recommendations: string[];
}

export function generateCoverageReport(resume: ResumeV3, jdAnalysis: JDAnalyzerOutput): CoverageReport
```

Scoring formula:
- Section score: Strong=1, Partial=0.5, Gap=0
- Phrase score: highUsed / highTotal
- Gap penalty: 0.1 per High gap
- Overall: (sectionScore * 0.5 + phraseScore * 0.4) * 100 - gapPenalty

### 4. `src/lib/v3/index.ts`

Main entry point:

```typescript
export interface V3Output {
  resume: ResumeV3;
  docxBuffer: Buffer;
  coverageReport: CoverageReport;
  diagnostics: V3Diagnostics;
}

export async function generateResumeV3(
  jobDescription: string,
  profileId: string
): Promise<V3Output>
```

Orchestrates:
1. Run pipeline
2. Assemble resume
3. Generate DOCX
4. Generate coverage report
5. Return all

## Test

Extend e2e test to generate DOCX:

```typescript
import { generateResumeV3 } from '../index';
import { Packer } from 'docx';
import fs from 'fs';

const result = await generateResumeV3(BANKRATE_JD, 'default');

// Save DOCX
const buffer = await Packer.toBuffer(result.docxBuffer);
fs.writeFileSync('test-resume-v3.docx', buffer);

// Log coverage
console.log('Coverage:', result.coverageReport.overall);
```

## Validation Steps

1. `npx tsc --noEmit src/lib/v3/*.ts` — passes
2. DOCX opens in Word/Google Docs without errors
3. All resume sections present in DOCX
4. Coverage report shows reasonable scores

## Commit
`feat(v3): add assembler and DOCX generator`
```

## Expected Output

```
src/lib/v3/
├── index.ts            (NEW)
├── assembler.ts        (NEW)
├── docx-generator.ts   (NEW)
├── coverage-report.ts  (NEW)
└── ... (existing files)
```

---

# Session 7: API + UI

**Time:** 90 minutes  
**Focus:** API route and UI integration

## Claude Code Prompt

```markdown
# Task: Create V3 API Route and UI Toggle

## Context
Add a V3 generation endpoint and UI toggle to switch between V2.1 and V3.

## Pre-requisites
- Session 6 complete (full V3 pipeline works)

## Files to Create/Modify

### 1. `src/app/api/v3/generate/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { generateResumeV3 } from '@/lib/v3';

export async function POST(request: NextRequest) {
  const { jobDescription, profileId } = await request.json();
  
  // Validation
  if (!jobDescription) {
    return NextResponse.json({ error: 'Job description required' }, { status: 400 });
  }

  try {
    const result = await generateResumeV3(jobDescription, profileId || 'default');
    
    return NextResponse.json({
      success: true,
      resume: result.resume,
      coverageReport: result.coverageReport,
      diagnostics: {
        sessionId: result.diagnostics.sessionId,
        totalCost: result.diagnostics.totalCost,
        totalDurationMs: result.diagnostics.totalDurationMs,
        steps: result.diagnostics.steps.map(s => ({
          step: s.step,
          status: s.status,
          durationMs: s.durationMs,
          retryCount: s.retryCount
        }))
      }
    });
  } catch (error) {
    console.error('V3 generation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Generation failed' },
      { status: 500 }
    );
  }
}
```

### 2. `src/app/api/v3/generate/download/route.ts`

Endpoint to download DOCX:

```typescript
export async function POST(request: NextRequest) {
  const { jobDescription, profileId } = await request.json();
  
  const result = await generateResumeV3(jobDescription, profileId || 'default');
  const buffer = await Packer.toBuffer(result.docxBuffer);
  
  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="resume-v3-${result.diagnostics.sessionId}.docx"`
    }
  });
}
```

### 3. UI Changes

Modify the main generation page to add V3 toggle:

**Add version toggle:**
```tsx
const [version, setVersion] = useState<'v2' | 'v3'>('v2');

<select value={version} onChange={(e) => setVersion(e.target.value)}>
  <option value="v2">V2.1 (Current)</option>
  <option value="v3">V3 (Beta)</option>
</select>
```

**Call appropriate endpoint:**
```tsx
const endpoint = version === 'v3' ? '/api/v3/generate' : '/api/generate';
const response = await fetch(endpoint, { ... });
```

**Display V3 diagnostics:**
```tsx
{version === 'v3' && result.diagnostics && (
  <div className="diagnostics">
    <h3>V3 Diagnostics</h3>
    <p>Cost: ${result.diagnostics.totalCost.toFixed(4)}</p>
    <p>Duration: {(result.diagnostics.totalDurationMs / 1000).toFixed(1)}s</p>
    <ul>
      {result.diagnostics.steps.map(s => (
        <li key={s.step}>{s.step}: {s.status} ({s.durationMs}ms)</li>
      ))}
    </ul>
  </div>
)}
```

**Display coverage report:**
```tsx
{version === 'v3' && result.coverageReport && (
  <div className="coverage">
    <h3>JD Coverage: {result.coverageReport.overall.grade} ({result.coverageReport.overall.score}%)</h3>
    {result.coverageReport.recommendations.map((r, i) => (
      <p key={i}>⚠️ {r}</p>
    ))}
  </div>
)}
```

## Validation Steps

1. Start dev server: `npm run dev`
2. Navigate to generation page
3. Toggle to V3
4. Paste Bankrate JD
5. Generate — should complete in 2-3 minutes
6. Verify:
   - Resume JSON displayed
   - Diagnostics show all 6 steps
   - Coverage report shows grade
   - Download DOCX works

## Commit
`feat(v3): add API route and UI integration`
```

## Expected Output

```
src/app/api/v3/
├── generate/
│   ├── route.ts
│   └── download/
│       └── route.ts
```

Plus UI modifications to generation page.

---

# Session 8: Testing + Polish

**Time:** 60 minutes  
**Focus:** Quality validation and fixes

## Claude Code Prompt

```markdown
# Task: Test V3 with Multiple JDs and Fix Issues

## Context
Final testing session. Run V3 against multiple job descriptions, compare output quality to V2.1, and fix any issues found.

## Test JDs

Test with 3 different JDs:
1. **Bankrate** — Financial services, editorial focus
2. **Consumer Brand** — CPG or retail, brand strategy focus
3. **B2B Tech** — SaaS or enterprise, growth marketing focus

For each JD:
1. Generate with V3
2. Review output quality:
   - Does summary use JD phrases naturally?
   - Are CHs diverse and relevant?
   - Are bullets specific with metrics?
   - Is there keyword stuffing?
   - Are there repeated verbs?
3. Check coverage report accuracy
4. Compare to V2.1 output (if available)

## Quality Checklist

For each generated resume:

### Summary
- [ ] 140-160 words
- [ ] Opens with hook, not "Name is a..."
- [ ] Contains 3+ JD phrases
- [ ] No forbidden words
- [ ] No emdash

### Career Highlights
- [ ] All 5 present
- [ ] No duplicate base IDs
- [ ] No duplicate verbs
- [ ] Each 35-50 words
- [ ] Bold headlines
- [ ] 2+ address HIGH phrases

### P1 Bullets
- [ ] 4 bullets, 25-40 words each
- [ ] No verbs repeated from CH
- [ ] No metrics repeated from Summary/CH
- [ ] Address gaps identified by CH

### P2 Bullets
- [ ] 3 bullets, 25-40 words each
- [ ] Shows pattern (not repetition of P1)
- [ ] No banned verbs/metrics

### P3-P6
- [ ] 4 overviews, 20-40 words
- [ ] No verb repetition
- [ ] Coherent trajectory narrative

### Coverage Report
- [ ] Score seems reasonable
- [ ] Gaps identified match actual gaps
- [ ] Recommendations actionable

## Common Issues to Watch For

1. **Word count violations** — Validators should catch, but verify
2. **Keyword stuffing** — Phrases forced unnaturally
3. **Repeated content** — Same achievement in CH and bullet
4. **Generic output** — Could apply to any job
5. **Metric drift** — $727M becomes $700M+
6. **Voice inconsistency** — Formal in summary, casual in bullets

## Fixes

If issues found:
1. Identify which prompt caused the issue
2. Update prompt with clearer instructions
3. Re-test with same JD
4. Verify fix doesn't break other JDs

## Documentation

Update README or create V3_RELEASE_NOTES.md:
- What's new in V3
- Known limitations
- Usage instructions
- Cost estimates

## Commit
`test(v3): add integration tests and quality fixes`
```

## Expected Outcomes

- [ ] 3 JDs tested successfully
- [ ] Quality comparable or better than V2.1
- [ ] No critical bugs
- [ ] Documentation updated

---

# Quick Reference: All Commits

```bash
# Session 1
git add src/lib/v3/types.ts src/lib/v3/validators.ts src/lib/v3/__tests__/
git commit -m "feat(v3): add types and validators"

# Session 2
git add src/lib/v3/voice-guide.ts src/lib/v3/prompts/
git commit -m "feat(v3): add JD analyzer and summary chat prompts"

# Session 3
git add src/lib/v3/prompts/ch-chat.ts src/lib/v3/prompts/p1-chat.ts
git commit -m "feat(v3): add CH and P1 chat prompts"

# Session 4
git add src/lib/v3/prompts/p2-chat.ts src/lib/v3/prompts/p3p6-chat.ts
git commit -m "feat(v3): add P2 and P3-P6 chat prompts"

# Session 5
git add src/lib/v3/orchestrator.ts src/lib/v3/content-loader.ts src/lib/v3/claude-client.ts
git commit -m "feat(v3): add orchestrator with retry logic and content loader"

# Session 6
git add src/lib/v3/index.ts src/lib/v3/assembler.ts src/lib/v3/docx-generator.ts src/lib/v3/coverage-report.ts
git commit -m "feat(v3): add assembler and DOCX generator"

# Session 7
git add src/app/api/v3/
git commit -m "feat(v3): add API route and UI integration"

# Session 8
git add .
git commit -m "test(v3): add integration tests and quality fixes"
```

---

# Final File Structure

After all sessions:

```
src/lib/v3/
├── index.ts
├── types.ts
├── validators.ts
├── voice-guide.ts
├── claude-client.ts
├── content-loader.ts
├── orchestrator.ts
├── assembler.ts
├── docx-generator.ts
├── coverage-report.ts
├── prompts/
│   ├── index.ts
│   ├── jd-analyzer.ts
│   ├── summary-chat.ts
│   ├── ch-chat.ts
│   ├── p1-chat.ts
│   ├── p2-chat.ts
│   └── p3p6-chat.ts
└── __tests__/
    ├── validators.test.ts
    ├── orchestrator.test.ts
    └── e2e-test.ts

src/app/api/v3/
├── generate/
│   ├── route.ts
│   └── download/
│       └── route.ts
```
