# ResumeOS V1.5 Upgrade — One-Shot Generation with Gap Recommendations

> **Goal**: Replace 8-step section-by-section flow with one-shot full resume generation + gap recommendations
> **Strategy**: 6 focused sessions, each completable in one Claude Code context window
> **Each session**: 30-60 min, commits before context fills
> **Handoff**: HANDOFF.md updated at end of each session

---

## What We're Building

### Current Flow (V1)
```
Paste JD → Analyze → Generate Summary → Approve → Generate Highlights → Approve → 
Generate P1 → Approve → Generate P2 → Approve → Generate P3-6 → Approve → Export
```
**Problems**: 10+ API calls, repetitive approvals, no holistic view, phrase repetition across sections

### New Flow (V1.5)
```
Paste JD → Deep Analysis → ONE-SHOT FULL GENERATION → Quality Check → 
Gap Recommendations (if any) → User Reviews Complete Resume → Refine via Chat → Export
```
**Benefits**: Single generation with full context, automatic narrative reshaping, gaps surfaced only when system can't solve them

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│  1. JD INPUT                                                     │
│     User pastes job description                                  │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  2. DEEP JD ANALYSIS                                             │
│     - Extract themes, rank by importance (must-have vs nice)     │
│     - Identify ATS keywords                                      │
│     - Map themes to content database                             │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  3. ONE-SHOT GENERATION                                          │
│     Single Claude call generates:                                │
│     - Summary (3-4 sentences)                                    │
│     - Career Highlights (5 bullets)                              │
│     - Position 1: Overview + 4 bullets                           │
│     - Position 2: Overview + 3 bullets                           │
│     - Positions 3-6: Overviews only                              │
│                                                                  │
│     With full context:                                           │
│     - All JD themes and keywords                                 │
│     - Complete content database                                  │
│     - Quality rules (length, verbs, jargon)                      │
│     - Phrase tracking (no repetition)                            │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  4. QUALITY GATE                                                 │
│     Automatic checks:                                            │
│     - Bullet length (≤40 words)                                  │
│     - Verb repetition (none within section, ≤2x resume)          │
│     - Phrase repetition (≤2x resume)                             │
│     - Jargon detection (no compound noun soup)                   │
│     - Theme coverage (priority themes addressed?)                │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  5. GAP DETECTION                                                │
│     Compare priority themes to themes_addressed                  │
│     If gaps exist AND content could address them:                │
│     → Surface 1-3 recommendations (max)                          │
│     → User accepts/skips each                                    │
│     → Accepted gaps trigger targeted regeneration                │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  6. USER REVIEW                                                  │
│     - Full resume preview                                        │
│     - Quality score displayed                                    │
│     - Chat refinement available                                  │
│     - Export when satisfied                                      │
└─────────────────────────────────────────────────────────────────┘
```

---

## Session Breakdown

### Session 1: Database + Types (30 min)
- Add new types for one-shot generation
- Update session schema for new data structure
- Add generated_resume JSONB column
- Add gaps, quality_scores columns

### Session 2: Master Generation Prompt (60 min)
- Create the one-shot generation prompt
- Include full content database in context
- Add all quality rules inline
- Handle content selection logic
- Return structured JSON output

### Session 3: One-Shot API Route (45 min)
- Create POST /api/generate-resume
- Fetch all content from database
- Call Claude with master prompt
- Parse and store results
- Return complete resume

### Session 4: Gap Detection + Recommendations (45 min)
- Create gap detection logic
- Generate recommendations for addressable gaps
- Create POST /api/address-gap for targeted regeneration
- Build GapRecommendations component

### Session 5: Quality Gate System (45 min)
- Create quality checking functions
- Bullet length validation
- Verb/phrase repetition detection
- Jargon pattern detection
- Quality score calculation

### Session 6: UI Overhaul (60 min)
- Remove 8-step wizard
- Single page: input → generate → review
- Gap recommendations panel
- Quality indicators
- Chat refinement (keep existing)
- Connect to new API

---

## Files Changed Per Session

| Session | New Files | Modified Files |
|---------|-----------|----------------|
| 1 | — | `src/types/index.ts`, `src/drizzle/schema.ts` |
| 2 | `src/lib/prompts/master-generation.ts` | `src/lib/claude.ts` |
| 3 | `src/app/api/generate-resume/route.ts` | — |
| 4 | `src/lib/gap-detection.ts`, `src/app/api/address-gap/route.ts`, `src/components/resume/GapRecommendations.tsx` | — |
| 5 | `src/lib/quality-check.ts` | `src/app/api/generate-resume/route.ts` |
| 6 | `src/components/resume/OneShot*.tsx` | `src/app/page.tsx`, `src/components/resume/ResumeBuilder.tsx` |

---

## API Changes

| Old Route | Status | New Route |
|-----------|--------|-----------|
| `POST /api/generate-section` | DEPRECATED | `POST /api/generate-resume` |
| `POST /api/approve-section` | DEPRECATED | Not needed |
| `POST /api/search-content` | DEPRECATED | Moved inside generate-resume |
| `POST /api/analyze-jd` | KEEP | Enhanced analysis |
| `POST /api/refine-section` | KEEP → MODIFY | `POST /api/refine` |
| `POST /api/export-docx` | KEEP | Updated for new data structure |
| — | NEW | `POST /api/address-gap` |

---

## Data Model Changes

```typescript
// NEW: One-shot generated resume
interface GeneratedResume {
  summary: string;
  career_highlights: string[];
  positions: GeneratedPosition[];
  themes_addressed: string[];
  themes_not_addressed: string[];
  content_ids_used: string[];
  generated_at: Date;
}

interface GeneratedPosition {
  number: 1 | 2 | 3 | 4 | 5 | 6;
  overview: string;
  bullets?: string[]; // Only P1 (4) and P2 (3)
}

// NEW: Gap tracking
interface Gap {
  id: string;
  theme: string;
  severity: 'critical' | 'moderate' | 'minor';
  reason: string;
  recommendation?: GapRecommendation;
  status: 'open' | 'addressed' | 'skipped';
}

interface GapRecommendation {
  affectedSections: string[];
  suggestion: string;
  contentToReframe?: string;
}

// NEW: Quality scoring
interface QualityScore {
  overall: 'A' | 'B' | 'C' | 'D' | 'F';
  keyword_coverage: number; // 0-100
  theme_alignment: number; // 0-100
  issues: QualityIssue[];
}

interface QualityIssue {
  type: 'bullet_length' | 'verb_repetition' | 'phrase_repetition' | 'jargon';
  severity: 'error' | 'warning';
  location: string;
  message: string;
}
```

---

## Quality Rules (Enforced in Generation)

### Bullet Constraints
- Maximum 40 words (hard limit)
- One sentence preferred, two short sentences max
- Structure: Action verb → What → Result/metric
- No compound nouns >3 words

### Verb Rules
- Never repeat within a position
- Maximum 2x in entire resume
- Track across all sections during generation

### Phrase Rules
- Never use same phrase >2x in entire resume
- Require synonyms after first use
- Track during generation

### Jargon Rules
- Never create abstract entity names
- Preserve specific entities from source content
- "regional bank" stays "regional bank", not "B2B banking partner"

### Keyword Integration
- Priority themes: must appear at least once
- Secondary themes: only if natural fit
- Never force awkward insertions

---

## Success Criteria

After all 6 sessions:

1. [ ] Can paste JD and get complete resume in one click
2. [ ] Resume addresses JD themes without explicit instruction
3. [ ] No bullet >40 words
4. [ ] No verb repeated within any position
5. [ ] No phrase repeated >2x in resume
6. [ ] No jargon soup ("B2B banking partner")
7. [ ] Gaps surfaced only when system can't solve them
8. [ ] User can refine via chat
9. [ ] DOCX export works with new structure
10. [ ] Quality score visible

---

## Execution Guide

### Before Starting
1. Commit current state: `git add . && git commit -m "checkpoint: before V1.5"`
2. Create branch: `git checkout -b v1.5-one-shot`
3. Add session files to project root

### For Each Session
1. Start fresh Claude Code session
2. Say: `Read SESSION_X_*.md and execute`
3. Let Claude Code work
4. Commit when each piece works
5. Update HANDOFF.md
6. Push to branch

### After All Sessions
1. Full end-to-end test
2. Compare output quality to V1
3. Merge to main when satisfied
4. Deploy to Vercel

---

## Rollback Plan

If V1.5 doesn't work:
```bash
git checkout main
git branch -D v1.5-one-shot
```

V1 remains untouched on main branch.
