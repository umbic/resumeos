# ResumeOS V1.5 Upgrade — Session Files

These files guide Claude Code through implementing one-shot resume generation with gap recommendations.

## Quick Start

1. Copy all files to your ResumeOS project root
2. Create a branch: `git checkout -b v1.5-one-shot`
3. Start a fresh Claude Code session
4. Say: `Read SESSION_1_DATABASE_TYPES.md and execute`
5. Commit when done, then start new session for next file

## Session Order

| # | File | What It Does | Time |
|---|------|--------------|------|
| 1 | `SESSION_1_DATABASE_TYPES.md` | Add types and DB columns | 30 min |
| 2 | `SESSION_2_MASTER_PROMPT.md` | Create one-shot generation prompt | 60 min |
| 3 | `SESSION_3_API_ROUTE.md` | Build /api/generate-resume endpoint | 45 min |
| 4 | `SESSION_4_GAP_DETECTION.md` | Add gap detection + recommendations | 45 min |
| 5 | `SESSION_5_QUALITY_GATE.md` | Add quality checks + auto-fix | 45 min |
| 6 | `SESSION_6_UI_OVERHAUL.md` | Replace wizard with single-page flow | 60 min |

**Total: ~4.5 hours across 6 sessions**

## Between Sessions

- Use `/clear` to start fresh
- Commit after each session
- Check that HANDOFF.md is updated
- Push to branch before moving on

## What V1.5 Changes

| Before (V1) | After (V1.5) |
|-------------|--------------|
| 8-step wizard | Single page: generate → review |
| Section-by-section generation | One-shot full resume |
| Manual review each section | Automatic quality checks |
| No gap detection | Smart gap recommendations |
| Keywords stuffed | Narrative reshaping |

## Key Files Created

```
src/
├── types/index.ts                    (modified)
├── drizzle/schema.ts                 (modified)
├── lib/
│   ├── prompts/master-generation.ts  (new)
│   ├── gap-detection.ts              (new)
│   ├── quality-check.ts              (new)
│   └── quality-fix.ts                (new)
├── app/api/
│   ├── generate-resume/route.ts      (new)
│   ├── address-gap/route.ts          (new)
│   ├── skip-gap/route.ts             (new)
│   └── refine/route.ts               (new)
└── components/resume/
    ├── OneShotInput.tsx              (new)
    ├── OneShotReview.tsx             (new)
    ├── ResumePreview.tsx             (new)
    ├── ChatRefinement.tsx            (new)
    ├── GapRecommendations.tsx        (new)
    └── QualityIndicator.tsx          (new)
```

## Rollback

If something breaks:
```bash
git checkout main
git branch -D v1.5-one-shot
```

V1 remains untouched on main.

## After All Sessions

1. Full end-to-end test with real JD
2. Compare output quality to V1
3. Check DOCX export
4. Merge to main when satisfied
5. Deploy to Vercel
