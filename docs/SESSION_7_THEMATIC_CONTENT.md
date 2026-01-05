# Session 7: Thematic Content & 3-Level Scoring

## Summary

This session implemented a major upgrade to how summaries and overviews are selected, moving from simple function-only scoring to a full 3-level scoring system (industry + function + theme).

## Changes Made

### 1. Content Database (`src/data/content-database.json`)

**Before**: 20 generic summaries (SUM-BR-01 through SUM-GE-05) with only `functionTags`

**After**: 8 thematic summaries with full tag coverage:

| ID | Theme | Industries | Functions |
|----|-------|------------|-----------|
| SUM-B2B | B2B/Enterprise | B2B, enterprise, professional-services | brand-strategy, executive-advisory |
| SUM-FS | Financial Services | financial-services, banking, wealth-management | brand-strategy, brand-architecture |
| SUM-TECH | Technology | technology, SaaS, enterprise-software | brand-strategy, product-marketing |
| SUM-CON | Consumer | consumer, CPG, retail, DTC | brand-strategy, integrated-campaign |
| SUM-CE | Creative Excellence | consumer, healthcare, B2B | creative-strategy, brand-storytelling |
| SUM-PM | Product Marketing | B2B, technology, SaaS | product-marketing, positioning, GTM |
| SUM-BS | Brand Strategy | professional-services, B2B, consumer | brand-strategy, brand-architecture |
| SUM-PG | Performance/Growth | B2B, technology, consumer | growth-marketing, performance-marketing |

Each summary now includes:
- `industryTags` - sector alignment
- `functionTags` - role type alignment
- `themeTags` - specific skill/approach alignment

### 2. Variants Database (`src/data/variants.json`)

Added new `overview_variants` array with 16 variants:

**Position 1 Variants** (8 total):
- OV-P1-B2B, OV-P1-FS, OV-P1-TECH, OV-P1-CON
- OV-P1-CE, OV-P1-PM, OV-P1-BS, OV-P1-PG

**Position 2 Variants** (8 total):
- OV-P2-B2B, OV-P2-FS, OV-P2-TECH, OV-P2-CON
- OV-P2-CE, OV-P2-PM, OV-P2-BS, OV-P2-PG

Each variant includes:
- `content` - the overview text tailored to the theme
- `industry_tags` - industries this variant is best for
- `function_tags` - functions this variant is best for
- `theme_tags` - themes this variant emphasizes

### 3. Content Selector (`src/lib/content-selector.ts`)

**Summary Selection** (lines 606-650):
- Now uses full 3-level scoring: `industryScore + functionScore + themeScore`
- Logs detailed scoring decisions to diagnostics
- Selects summary with highest combined score

**Overview Selection** (lines 652-736):
- For P1 and P2: Scores all 8 variants using 3-level scoring, selects best match
- For P3-P6: Uses base overviews (no variants available)
- Logs detailed scoring decisions to diagnostics

### 4. Seed Script (`scripts/seed-database.ts`)

- Added `industryTags` and `themeTags` to content item seeding
- Added `OverviewVariant` interface
- Added `seedOverviewVariants()` function to process the new variants
- Updated embedding text generation to include all tag types

## Database State

After seeding:
- 52 content items (including 8 summaries)
- 10 conflict rules
- 21 base items with metadata
- 76 CH/bullet variants
- 16 overview variants

## How Scoring Works

For any JD, the system extracts:
- `industries` - detected sectors (e.g., "financial-services", "technology")
- `functions` - detected role types (e.g., "brand-strategy", "GTM")
- `themes` - detected approaches (e.g., "acquisition", "creative-excellence")

Each content item is scored:
```
totalScore = industryScore + functionScore + themeScore
```

Where each sub-score is calculated based on tag overlap between the JD analysis and the item's tags.

## Files Changed

| File | Changes |
|------|---------|
| `src/data/content-database.json` | Replaced 20 summaries with 8 thematic ones |
| `src/data/variants.json` | Added `overview_variants` array (16 items) |
| `src/lib/content-selector.ts` | Added 3-level scoring for summaries and overviews |
| `scripts/seed-database.ts` | Added overview variant seeding |
| `CLAUDE.md` | Updated documentation |

## Testing

To verify the implementation:
1. Submit a JD with clear industry/function signals
2. Check diagnostics to see summary scoring
3. Verify selected summary matches expected theme
4. Check P1/P2 overview variants in diagnostics
5. Verify P3-P6 use base overviews

## Next Steps (Potential)

1. Add overview variants for P3-P6 (currently using base overviews)
2. Fine-tune tag mappings based on real JD testing
3. Add more summaries for edge cases (healthcare, media, etc.)
4. Consider weighting industry vs function vs theme differently

---

# Session 7b: Enhanced Diagnostics

## Summary

Added comprehensive diagnostics logging and a dedicated diagnostics page for viewing resume generation details.

## Changes Made

### 1. Dedicated Diagnostics Page (`/diagnostics/[sessionId]`)

Created a full-page diagnostics view at `src/app/diagnostics/[sessionId]/page.tsx`:
- Full-width layout for better readability
- Collapsible sections for each generation step
- Copy buttons on all prompts/responses/data
- Expand/collapse all controls
- Summary stats (duration, tokens, cost, status)
- Export to JSON functionality

### 2. DiagnosticsPanel Link

Added "Full Page" link to `DiagnosticsPanel.tsx` that opens diagnostics in a new tab.

### 3. Enhanced Claude.ts Logging

Updated `analyzeJobDescription()` to log:
- Full JD analysis prompt (verbatim)
- Full Claude response (verbatim)
- Actual token counts from API
- Parsed output summary (keywords, themes, etc.)

### 4. Enhanced Content-Selector Logging

Updated `selectBestVariant()` to log:
- All variant scores for each base item
- Winner selection with comparison
- Theme tag matching details

## Files Changed

| File | Changes |
|------|---------|
| `src/app/diagnostics/[sessionId]/page.tsx` | New dedicated page |
| `src/components/diagnostics/DiagnosticsPanel.tsx` | Added "Full Page" link |
| `src/lib/claude.ts` | Added JD analysis diagnostics |
| `src/lib/content-selector.ts` | Enhanced variant logging |
| `CLAUDE.md` | Added diagnostics documentation |

## What Gets Logged

| Step | Logged Data |
|------|-------------|
| JD Analysis | Prompt, response, keywords, themes, company lookup |
| Content Selection | Every item scored with industry/function/theme breakdown |
| Variant Comparison | All variants scored for each base item |
| Conflict Blocking | Which items blocked due to metric conflicts |
| Rewrite | Full prompt/response with token counts and cost |
| Final Assembly | Selected content IDs and keyword coverage |

## Usage

1. Generate a resume for any session
2. View diagnostics in the panel (right side)
3. Click "Full Page" to open dedicated view at `/diagnostics/{sessionId}`
4. Click "Export" to download full JSON
