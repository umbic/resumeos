# Session 1: Database + Types for One-Shot Generation

> **Time**: 30 minutes
> **Scope**: Add new types and database columns for one-shot generation
> **No UI or API changes yet**

---

## Context

We're replacing the 8-step section-by-section generation with one-shot full resume generation. This session sets up the data structures.

---

## Task 1: Add New Types

**File**: `src/types/index.ts`

Add these interfaces:

```typescript
// One-shot generated resume structure
export interface GeneratedResume {
  summary: string;
  career_highlights: string[];
  positions: GeneratedPosition[];
  themes_addressed: string[];
  themes_not_addressed: string[];
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

// Enhanced JD Analysis (extends existing)
export interface EnhancedJDAnalysis {
  target_title: string;
  target_company: string;
  priority_themes: JDTheme[];
  secondary_themes: JDTheme[];
  ats_keywords: string[];
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
```

---

## Task 2: Update Database Schema

**File**: `src/drizzle/schema.ts`

Add these columns to the sessions table:

```typescript
// Add to sessions table definition
generated_resume: jsonb('generated_resume').$type<GeneratedResume>(),
gaps: jsonb('gaps').$type<Gap[]>().default([]),
quality_score: jsonb('quality_score').$type<QualityScore>(),
used_verbs: text('used_verbs').array().default([]),
used_phrases: text('used_phrases').array().default([]),
generation_version: text('generation_version').default('v1'), // 'v1' or 'v1.5'
```

Keep all existing columns — we need backward compatibility with V1.

---

## Task 3: Generate Migration

Run:
```bash
npm run db:generate
```

Then apply:
```bash
npm run db:migrate
```

If your project uses a different migration command, adjust accordingly.

---

## Task 4: Update Zustand Store (if applicable)

**File**: `src/lib/store.ts`

If using Zustand for client state, add:

```typescript
// Add to store state
generatedResume: GeneratedResume | null;
gaps: Gap[];
qualityScore: QualityScore | null;
isGenerating: boolean;

// Add actions
setGeneratedResume: (resume: GeneratedResume) => void;
setGaps: (gaps: Gap[]) => void;
setQualityScore: (score: QualityScore) => void;
updateGapStatus: (gapId: string, status: 'addressed' | 'skipped') => void;
clearGeneration: () => void;
```

---

## Commit

```bash
git add .
git commit -m "feat: add types and schema for one-shot generation"
```

---

## Update HANDOFF.md

Add:
```markdown
## Session 1 Complete: Database + Types

**What was done**:
- Added GeneratedResume, Gap, QualityScore types
- Added database columns for one-shot generation
- Migration applied
- Zustand store updated (if applicable)

**Next**: Session 2 — Master Generation Prompt
```

---

## Success Criteria

- [ ] Types compile without errors
- [ ] Migration runs successfully
- [ ] Existing V1 functionality still works (backward compatible)
- [ ] Store has new state fields (if using Zustand)

---

## Do NOT Do Yet

- Don't create any API routes
- Don't modify Claude prompts
- Don't change UI components
- Don't touch existing generate-section logic

Those come in later sessions.
