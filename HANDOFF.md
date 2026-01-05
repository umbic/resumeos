# ResumeOS - Session Handoff

> **Last Updated**: 2026-01-04
> **Last Session**: Session 8 - JD Evidence Preservation Fix

---

## Session 8 Completed: JD Evidence Preservation Fix

### Problem Diagnosed

The `convertToEnhancedAnalysis()` function in `generate-resume/route.ts` was replacing actual JD evidence with placeholder text like "Strategic positioning theme for Head of Brand Strategy role". This meant Claude had no context about WHY themes mattered or what specific JD language to use for tailoring.

### Root Cause

1. **JD analysis prompt** extracted themes as plain strings, not objects with evidence
2. **Conversion function** created generic placeholder evidence instead of preserving real data
3. **Keyword placement** data was being stripped during conversion

### Fixes Implemented

#### 1. Updated Types (`src/types/index.ts`)
- Added `PositioningTheme` interface with `theme`, `evidence`, and `jd_quotes` fields
- Changed `JDStrategic.positioningThemes` from `string[]` to `PositioningTheme[]`
- Added `placement` field to `ATSKeyword` interface

#### 2. Enhanced JD Analysis Prompt (`src/lib/claude.ts`)
- Updated prompt to request themes with evidence and JD quotes
- New JSON output format includes:
  ```json
  {
    "theme": "Enterprise transformation leader",
    "evidence": "JD mentions 'enterprise-wide brand transformation' as primary responsibility",
    "jd_quotes": ["drive brand evolution", "modernize legacy architecture"]
  }
  ```

#### 3. Fixed `convertToEnhancedAnalysis()` (`src/app/api/generate-resume/route.ts`)
- Now uses actual evidence from JD analysis instead of placeholder text
- Handles both new format (objects) and legacy format (strings)
- Preserves keyword `placement` data
- Added `validateNoConflicts()` function for server-side conflict detection
- Returns `conflict_violations` in API response

#### 4. Updated Store (`src/lib/store.ts`)
- `setJDAnalysis` now accepts both formats (strings or PositioningTheme objects)
- Normalizes data to `PositioningTheme[]` when storing

#### 5. Fixed Refine Route (`src/app/api/refine/route.ts`)
- Handles both new and legacy theme formats

### Before vs After

**Before** (broken):
```
1. **Enterprise transformation leader**
   - Why it matters: Strategic positioning theme for Head of Brand Strategy role
```

**After** (fixed):
```
1. **Enterprise transformation leader**
   - Why it matters: JD mentions 'enterprise-wide brand transformation' as primary responsibility. Key phrases: "drive brand evolution", "modernize legacy architecture"
```

### Files Modified
| File | Change |
|------|--------|
| `src/types/index.ts` | Added PositioningTheme interface, updated JDStrategic, added placement to ATSKeyword |
| `src/lib/claude.ts` | Enhanced JD analysis prompt for theme evidence |
| `src/app/api/generate-resume/route.ts` | Fixed conversion function, added conflict validation |
| `src/lib/store.ts` | Handle both theme formats in setJDAnalysis |
| `src/app/api/refine/route.ts` | Handle both theme formats |

### Testing Notes
- New sessions will get full evidence in themes
- Old sessions with string-only themes will still work (backwards compatible)
- Conflict violations are logged and returned in API response

---

## Session 7 Completed: Bug Fixes & Codebase Cleanup

### What Was Done

Fixed critical bugs and cleaned up unused files from the codebase.

### Bug Fixes

#### 1. `e.split is not a function` Error
**Problem**: Resume generation was failing with `TypeError: e.split is not a function`

**Root Cause**: The master generation prompt tells Claude to return `career_highlights` and `bullets` as objects with `{id, base_id, variant_label, content}`, but the TypeScript types and quality-check code expected plain strings.

**Fix**:
- `src/lib/prompts/master-generation.ts`: Added transformation in `parseGenerationResponse()` to extract `.content` from objects
- `src/lib/quality-check.ts`: Added safety checks to convert non-strings before calling `.split()`
- `src/lib/gap-detection.ts`: Added `toStr()` helper for `getAllResumeText()` function

#### 2. Past Sessions Not Opening
**Problem**: Clicking "Open" on old sessions would return to dashboard instead of showing the resume

**Root Cause**: Old sessions stored `career_highlights` as objects in the database. When loaded, the UI tried to render objects as strings and failed silently.

**Fix**:
- `src/app/page.tsx`: Added transformation in `loadSession()` to convert legacy object format to strings
- `src/lib/render-highlights.tsx`: Added safety check in `renderContent()` to extract `.content` from objects

### Codebase Cleanup

Removed **26 unused files** totaling **7,213 lines**:

| Category | Files Removed |
|----------|---------------|
| Unused component | `src/components/resume/OneShotInput.tsx` (replaced by OneShotReview) |
| Test artifacts | `DEBUG_RESUME.docx`, `TEST_RESUME_ANTHROPIC.docx`, `TEST_V1_5_RESUME.docx`, `files.zip` |
| Legacy root docs | `PROMPT_AUDIT_REQUEST.md`, `PROMPT_AUDIT_RESULTS.md`, `REPO_ANALYSIS.md`, `TEST_RESULTS.md`, `TEST_V1_5_RESULTS.md` |
| Old docs folder | 18 files of v1/v2 architecture documentation |

### Files Modified
| File | Change |
|------|--------|
| `src/lib/prompts/master-generation.ts` | Transform objects to strings in parseGenerationResponse() |
| `src/lib/quality-check.ts` | Safety checks for .split() calls |
| `src/lib/gap-detection.ts` | toStr() helper for getAllResumeText() |
| `src/app/page.tsx` | Transform legacy resume format when loading sessions |
| `src/lib/render-highlights.tsx` | Safety check in renderContent() |

### Commits
- `5b6eb0b` - fix: handle object-to-string conversion in resume parsing
- `343228e` - fix: handle legacy resume format when loading sessions
- `efbc275` - chore: remove unused files and legacy documentation

---

## Session 6 Completed: Complete Variant System with P2 Bullets & Three-Level Matching

### What Was Done
Expanded the variant system to include all P2 bullet variants and implemented three-level matching in the master generation prompt. The system now supports intelligent content selection based on industry relevance, function relevance, and theme-based variant selection.

### P2 Variants Added

| Base ID | Client | Variants |
|---------|--------|----------|
| P2-B01 | SAP | 4 (Brand Strategy, Product Marketing, Sales Enablement, Customer Acquisition) |
| P2-B02 | Wild Turkey | 3 (Brand Repositioning, Creative Campaign, Social & Creator Campaign) |
| P2-B03 | Deloitte Consulting | 2 (Brand Strategy, Demand Generation) |
| P2-B04 | WNBA | 4 (Brand Strategy, Digital Engagement, Creative Storytelling, Customer Growth) |
| P2-B05 | Energizer Holdings | 3 (Portfolio Strategy, Rebranding, Integrated Campaign) |
| P2-B06 | Aspen Dental | 3 (Brand Platform, Growth Strategy, Integrated Campaign) |
| P2-B07 | MTN DEW GAME FUEL | 2 (Product Launch, Creative Campaign) |

### Updated Totals
- **21 base items** with industry/function tags (11 CH + 3 P1 + 7 P2)
- **76 total variants** (46 CH + 9 P1 + 21 P2)
- Database properly seeded with all variants and embeddings

### Three-Level Matching System

The master generation prompt now includes a three-level matching system:

**Level 1: Industry Relevance**
- Match base items' `industry_tags` to target company industry
- Prioritize achievements from relevant industries

**Level 2: Function Relevance**
- Match base items' `function_tags` to role type
- Prioritize items with matching functions (brand-strategy, product-marketing, etc.)

**Level 3: Variant Selection**
- For each selected base item, choose the variant whose `theme_tags` best match priority themes
- Use variant content instead of base content for better JD alignment

### Updated Output Format

Career highlights and position bullets now return structured objects:
```json
{
  "id": "CH-01-V2",
  "base_id": "CH-01",
  "variant_label": "Team Leadership",
  "content": "**Bold hook phrase**: Achievement narrative..."
}
```

### Files Modified
| File | Change |
|------|--------|
| `src/data/variants.json` | Renamed from career-highlight-variants.json, added P2 base items + 21 P2 variants |
| `scripts/seed-database.ts` | Updated to reference variants.json |
| `src/lib/prompts/master-generation.ts` | Added three-level matching, PromptVariant interface, variant formatting helpers |
| `src/lib/claude.ts` | Added fetchCareerHighlightVariants(), fetchPositionVariants(), updated generateFullResume() |

### Verification
```sql
-- Verified: 76 total variants seeded
SELECT COUNT(*) FROM content_items WHERE base_id IS NOT NULL;
-- Result: 76

-- Verified: Variants per base
SELECT base_id, COUNT(*) FROM content_items WHERE base_id IS NOT NULL GROUP BY base_id;
-- Shows correct distribution: CH variants (46), P1 variants (9), P2 variants (21)
```

### Next Steps
1. Test three-level matching with real JDs
2. Verify variant selection improves theme alignment
3. UI for displaying which variant was selected

---

## Session 5 Completed: Variant System for Career Highlights & P1 Bullets

### What Was Done
Added the initial variant system to ResumeOS. Variants are different framings of the same achievement — same facts/metrics, different angles depending on what the target JD emphasizes.

### Database Schema Changes

Added 6 new columns to `content_items` table (`src/drizzle/schema.ts`):
```typescript
base_id: text('base_id'),              // e.g., "CH-01" for variant "CH-01-V1"
variant_label: text('variant_label'),  // e.g., "Team Leadership"
context: text('context'),              // The situation/challenge
method: text('method'),                // The approach taken
theme_tags: jsonb('theme_tags'),       // Variant-specific emphasis tags
industry_tags: jsonb('industry_tags'), // Industries this content is relevant to
```

### Variants Created (Session 5)

| Base ID | Achievement | Variants |
|---------|-------------|----------|
| CH-01 | Deloitte Practice ($40M) | 5 |
| CH-02 | NWSL (50% attendance) | 5 |
| CH-03 | OOFOS (191% sales) | 4 |
| CH-04 | Deloitte Rebrand (43% leads) | 5 |
| CH-05 | PfizerForAll ($727M) | 4 |
| CH-06 | LTK ($2.8B→$5B) | 5 |
| CH-07 | NYU Langone (1.6M appts) | 3 |
| CH-08 | Gateway/Wholecare (30K) | 3 |
| CH-09 | Amex CRM (5%/12%) | 4 |
| CH-10 | GE Innovation (Cannes) | 4 |
| CH-11 | AI Tools (32% cost) | 4 |
| P1-B01 | Synovus (64.3% revenue) | 3 |
| P1-B06 | J&J Cell & Gene (20% sales) | 3 |
| P1-B10 | New York Life (23% awareness) | 3 |

**Session 5 Totals**: 14 base items updated, 55 variants seeded

### Variant Data Structure

Each variant includes:
- `id`: Unique ID (e.g., "CH-01-V1")
- `base_id`: Parent achievement (e.g., "CH-01")
- `variant_label`: Framing angle (e.g., "Practice Building", "Team Leadership")
- `context`: The situation/challenge this framing addresses
- `method`: The approach taken (for this angle)
- `content`: Full variant text with bold hook and metrics
- `theme_tags`: Tags for semantic matching to JD themes

### Commit
`daf0863` - feat: add variant system schema and seed career highlight variants

---

## Session 4d Completed: Chat Refinement with Full Context

### What Was Done
Added contextual chat refinement to the Section Editor. The "Refine" tab is now functional and sends full context (JD, JD analysis, entire resume, and chat history) to Claude for intelligent refinements.

### Changes Made

**Database Schema** (`src/drizzle/schema.ts`):
- Added `refinement_history` JSONB column for storing per-section chat history

**Migration**:
- Generated `0004_lively_doomsday.sql` for the refinement_history column

**New Type** (`src/types/index.ts`):
- Added `RefinementMessage` interface with id, section, role, content, timestamp

**Updated API Endpoint**: `src/app/api/refine/route.ts`

Complete rewrite with full context awareness:
- Request now takes: `sessionId`, `sectionKey`, `currentContent`, `userMessage`
- Fetches full session data (JD, JD analysis, full resume, chat history)
- Builds comprehensive prompt with all context
- Saves chat history and updated resume to database
- Returns refined content and updated chat history

Response:
```json
{
  "success": true,
  "refinedContent": "...",
  "chatHistory": [/* RefinementMessage[] for this section */]
}
```

**Updated API Endpoint**: `src/app/api/sessions/[id]/route.ts`
- GET now returns `refinement_history` field

**New Component**: `src/components/editor/RefineChat.tsx`
- Displays current section content (read-only)
- Shows chat history for this section with user/assistant message bubbles
- Quick suggestion chips (e.g., "Make it shorter", "Emphasize leadership")
- Text input for refinement requests
- Loading state while Claude processes
- Error handling and display
- Calls `onRefined` callback with new content and updated history

**Updated SectionEditor** (`src/components/editor/SectionEditor.tsx`):
- Added `sessionId` prop (required for refine API)
- Added `chatHistory` state and `chatHistoryFetched` flag
- Fetches chat history when Refine tab is opened
- Integrated `RefineChat` component in Refine tab
- `handleRefined` callback updates content, history, and switches to Edit tab

**Updated OneShotReview** (`src/components/resume/OneShotReview.tsx`):
- Now passes `sessionId` to SectionEditor

### Refinement Prompt Context

Each refinement request includes:
1. **Target Role** - Title and company from JD analysis
2. **Priority Themes** - From JD analysis
3. **ATS Keywords** - With frequency counts
4. **Full JD** - Complete job description text
5. **Full Resume** - Summary, highlights, all positions with bullets
6. **Section to Refine** - Current content being edited
7. **Chat History** - Previous refinements for this section
8. **User Request** - What the user wants changed
9. **Quality Rules** - Word limits, verb constraints, anti-jargon rules

### Files Created
| File | Description |
|------|-------------|
| `src/components/editor/RefineChat.tsx` | Chat refinement UI component |
| `src/drizzle/migrations/0004_lively_doomsday.sql` | Migration for refinement_history |

### Files Modified
| File | Change |
|------|--------|
| `src/types/index.ts` | Added RefinementMessage type |
| `src/drizzle/schema.ts` | Added refinement_history column |
| `src/app/api/refine/route.ts` | Complete rewrite with full context |
| `src/app/api/sessions/[id]/route.ts` | Return refinement_history in GET |
| `src/components/editor/SectionEditor.tsx` | Added sessionId prop, chat history state, RefineChat integration |
| `src/components/resume/OneShotReview.tsx` | Pass sessionId to SectionEditor |

### Testing Steps
1. Open a session with a generated resume
2. Click any section to open the editor
3. Click the "Refine" tab
4. See current content displayed at top
5. Type a refinement request (e.g., "Make it shorter") or click a suggestion
6. Click Send button
7. Loading state appears while Claude processes
8. Refined content appears, automatically switches to Edit tab
9. Can save the refined content or continue refining
10. Close and reopen editor - chat history persists
11. Refinements are context-aware (reference JD themes, aware of full resume)

---

### Next Session Focus: 4e - Integration & Polish
1. Final testing of all Section Editor tabs (Edit, Refine, Bank)
2. Bug fixes and UX polish
3. Verify refinements preserve quality rules
4. End-to-end flow testing

---

## Session 4c Completed: Content Bank

### What Was Done
Added a "Bank" tab to the Section Editor that shows alternative content options from the database. Users can browse and select alternative content items to replace current section content.

### Changes Made

**New API Endpoint**: `src/app/api/content-bank/route.ts`
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/content-bank` | Fetch alternative content items |

Query Parameters:
- `type` (required): `summary`, `career_highlight`, `bullet`, or `overview`
- `position` (optional): Position number (1-6) for bullets/overviews
- `exclude` (optional): Comma-separated content IDs to exclude (already used items)

Response:
```json
{
  "items": [
    {
      "id": "CH-03",
      "type": "career_highlight",
      "position": null,
      "contentShort": "...",
      "contentMedium": "...",
      "contentLong": "...",
      "contentGeneric": "...",
      "categoryTags": ["consumer", "DTC"],
      "outcomeTags": ["growth", "revenue"]
    }
  ]
}
```

**New Component**: `src/components/editor/ContentBank.tsx`
- Displays scrollable list of alternative content items
- Each card shows:
  - Content ID as header
  - Content preview (uses contentLong, falls back to contentMedium/Short)
  - Category and outcome tags
  - [Use This] button to select content
- For overviews: Shows Short/Medium/Long versions as separate cards
- Handles loading state and empty state

**Updated SectionEditor** (`src/components/editor/SectionEditor.tsx`):
- Added `usedContentIds` prop to track already-used content
- Added bank items state and loading state
- Added `getBankQueryParams()` helper to parse section key into API query params
- Fetches bank items when Bank tab is clicked (lazy loading)
- [Use This] puts selected content in textarea and switches to Edit tab
- Removed unused `sessionId` prop (not needed)

**Updated OneShotReview** (`src/components/resume/OneShotReview.tsx`):
- Passes `usedContentIds={resume.content_ids_used || []}` to SectionEditor
- Removed `sessionId` prop from SectionEditor (unused)

### Content Bank Query Mapping

| Section Type | API Query |
|--------------|-----------|
| Summary | `type=summary` |
| Career Highlights | `type=career_highlight&exclude=<used_ids>` |
| P1 Bullets | `type=bullet&position=1&exclude=<used_ids>` |
| P2 Bullets | `type=bullet&position=2&exclude=<used_ids>` |
| P3-P6 Bullets | `type=bullet&position=N` |
| Overviews | `type=overview&position=N` (shows 3 version cards) |

### Files Created
| File | Description |
|------|-------------|
| `src/app/api/content-bank/route.ts` | GET endpoint for fetching content items |
| `src/components/editor/ContentBank.tsx` | Content bank display component |

### Files Modified
| File | Change |
|------|--------|
| `src/components/editor/SectionEditor.tsx` | Added bank tab functionality, usedContentIds prop |
| `src/components/resume/OneShotReview.tsx` | Pass usedContentIds to SectionEditor |

---

## Session 4b Completed: Section Editor with Edit Mode

### What Was Done
Added a section editor that allows users to click any resume section and edit it directly with a modal editor.

### Changes Made

**New Component**: `src/components/editor/SectionEditor.tsx`
- Modal-based editor with Edit/Refine/Bank tabs (Edit is functional, others are placeholders)
- Textarea for direct content editing
- Word count display with target ranges for different section types
- Save Changes / Cancel buttons
- Unsaved changes indicator

**Updated ResumePreview** (`src/components/resume/ResumePreview.tsx`):
- Changed `onSectionClick` signature to pass both `sectionKey` and `content`
- All clickable sections now pass their content when clicked

**New API Endpoint**:
| Method | Endpoint | Description |
|--------|----------|-------------|
| PATCH | `/api/sessions/[id]/section` | Update a specific section in generated_resume |

Request:
```json
{
  "sectionKey": "highlight_1",
  "content": "New content..."
}
```

Response:
```json
{
  "success": true,
  "updated_at": "2026-01-04T...",
  "resume": { /* updated GeneratedResume */ }
}
```

**Updated OneShotReview** (`src/components/resume/OneShotReview.tsx`):
- Added `editingSection` state to track which section is being edited
- Added `handleSectionClick` handler that opens editor with content
- Added `handleSectionSave` that saves via API and updates parent state
- Renders `SectionEditor` modal when a section is selected

### Editable Sections (19 total)
| Section | Key | Word Target |
|---------|-----|-------------|
| Summary | `summary` | 50-75 |
| Career Highlights 1-5 | `highlight_1` to `highlight_5` | 40-55 |
| P1 Overview | `position_1_overview` | 35-50 |
| P1 Bullets 1-4 | `position_1_bullet_1` to `_4` | 30-40 |
| P2 Overview | `position_2_overview` | 35-50 |
| P2 Bullets 1-3 | `position_2_bullet_1` to `_3` | 30-40 |
| P3-P6 Overviews | `position_3_overview` to `_6` | 35-50 |

### Files Created
| File | Description |
|------|-------------|
| `src/components/editor/SectionEditor.tsx` | Modal editor component |
| `src/app/api/sessions/[id]/section/route.ts` | Section save API |

### Files Modified
| File | Change |
|------|--------|
| `src/components/resume/ResumePreview.tsx` | Pass content with section clicks |
| `src/components/resume/OneShotReview.tsx` | Integrate section editor |

---

## Session 4a Completed: Named Sessions + Dashboard

### What Was Done
Added named sessions and a dashboard to ResumeOS so users can save, name, and return to resume sessions.

### Changes Made

**Database Schema** (`src/drizzle/schema.ts`):
- Added `name` field (TEXT, nullable) for user-provided session names

**Migration**:
- Generated `0003_red_molecule_man.sql` for the name column

**New API Endpoints**:
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/sessions` | List all sessions for dashboard |
| GET | `/api/sessions/[id]` | Get single session details |
| PATCH | `/api/sessions/[id]` | Update session name |
| DELETE | `/api/sessions/[id]` | Delete a session |

**Updated API Endpoints**:
- `POST /api/analyze-jd` - Now accepts optional `name` parameter

**New Components**:
| Component | Description |
|-----------|-------------|
| `src/components/dashboard/SessionDashboard.tsx` | Main dashboard showing all sessions as cards |
| `src/components/dashboard/NewSessionModal.tsx` | Modal for creating new named sessions |

**UI Features**:
- Dashboard shows all sessions sorted by most recently modified
- Each session card displays: name (or "Unnamed Session"), target title, target company, quality score badge (A/B/C/D/F), created date, relative modified time
- [Open] button loads session in editor
- [Delete] button removes session with confirmation
- [+ New Session] opens modal with name input, format selection, JD textarea
- Back button in editor returns to dashboard
- URL updates with `?session=<id>` for direct linking

**Page Updates** (`src/app/page.tsx`):
- Refactored to show dashboard by default
- Added session loading state
- Added URL parameter handling for `?session=<id>`
- Added back-to-dashboard navigation

**OneShotReview Updates** (`src/components/resume/OneShotReview.tsx`):
- Added `onBackToDashboard` callback prop
- Added `sessionName` prop for header display
- Added back arrow button to dashboard

### Files Created
| File | Description |
|------|-------------|
| `src/app/api/sessions/route.ts` | GET sessions list |
| `src/app/api/sessions/[id]/route.ts` | GET/PATCH/DELETE single session |
| `src/components/dashboard/SessionDashboard.tsx` | Dashboard component |
| `src/components/dashboard/NewSessionModal.tsx` | New session modal |
| `src/drizzle/migrations/0003_red_molecule_man.sql` | Migration for name column |

### Files Modified
| File | Change |
|------|--------|
| `src/drizzle/schema.ts` | Added `name` field |
| `src/app/api/analyze-jd/route.ts` | Accept optional `name` parameter |
| `src/app/page.tsx` | Rewritten for dashboard flow |
| `src/components/resume/OneShotReview.tsx` | Added back navigation + session name display |

### Database Migration Required
After deployment, run the migration to add the `name` column:
```bash
npx drizzle-kit push
```
or via Vercel:
```bash
npx dotenv -e .env.local -- npm run db:migrate
```

---

### Next Session Focus: 4b - Section Editor
1. Add Edit mode for individual sections
2. Allow users to click a section and edit in-place
3. Add save/cancel for edits

---

## V1.5 Session 8 Completed: Keyword-Level Gap Detection

### What Was Done
Added keyword-level gap detection to catch missing ATS keywords that the theme-based detection missed.

### Problem Solved
- Quality score showed "Keywords: 100%" on resumes missing critical keywords (GTM, SaaS, API, Product Marketing)
- Old system only checked themes_addressed vs themes_not_addressed
- Didn't verify if specific keywords actually appeared in resume text

### Changes Made

**Types** (`src/types/index.ts`):
- Added `ATSKeyword` interface with frequency tracking
- Added `KeywordGap` interface for detected gaps
- Updated `EnhancedJDAnalysis.ats_keywords` from `string[]` to `ATSKeyword[]`

**JD Analysis** (`src/lib/claude.ts`):
- Updated prompt to extract keyword frequency count
- Mark keywords appearing 2+ times as `priority: 'high'`
- Include frequency in JSON output format

**Gap Detection** (`src/lib/gap-detection.ts`):
- Added `detectKeywordGaps()` - checks if high-priority keywords appear in resume
- Added `calculateActualKeywordCoverage()` - calculates real keyword presence
- Added `getAllResumeText()` helper - combines all resume sections for search
- Added variant matching (GTM ↔ go-to-market, B2B ↔ business-to-business)

**Quality Check** (`src/lib/quality-check.ts`):
- Updated `runQualityCheck()` to accept optional `atsKeywords` parameter
- Use actual keyword coverage when ATS keywords provided
- Updated `calculateGrade()` to cap grades based on keyword coverage:
  - < 30% coverage → max grade D
  - < 50% coverage → max grade C
  - < 70% coverage → max grade B

**Generate Resume** (`src/app/api/generate-resume/route.ts`):
- Pass `jdAnalysis.ats_keywords` to `runQualityCheck()`
- Call `detectKeywordGaps()` after generation
- Return `keyword_gaps` in API response

### Files Modified
| File | Change |
|------|--------|
| `src/types/index.ts` | Added ATSKeyword, KeywordGap interfaces |
| `src/lib/claude.ts` | Updated JD analysis prompt for frequency |
| `src/lib/gap-detection.ts` | Added detectKeywordGaps(), calculateActualKeywordCoverage() |
| `src/lib/quality-check.ts` | Updated runQualityCheck() signature, grade capping |
| `src/app/api/generate-resume/route.ts` | Integrated keyword gap detection |

### Commits
- `183013d` - feat: add keyword-level gap detection
- `547779c` - feat: add KeywordGaps UI component

### UI Added
**KeywordGaps Component** (`src/components/resume/KeywordGaps.tsx`):
- Shows "Missing Keywords" section with high-priority keywords (2+ frequency) not in resume
- Shows "Other Keywords" section with medium-priority keywords as reference
- Includes suggestion for which section could address each missing keyword
- Collapsible panel placed after Quality Score in review page

**Page Updates** (`src/app/page.tsx`):
- Added `keywordGaps` and `atsKeywords` state
- Capture `keyword_gaps` from generate-resume API response
- Capture keywords from analyze-jd API response
- Pass both to OneShotReview component

---

### Next Session Focus
1. **Test keyword gaps UI** - Verify missing keywords display correctly
2. **Address keyword gaps** - Allow user to regenerate with missing keywords (optional)

---

## V1.5 Session 7 Completed: Summary & Career Highlights Quality

### What Was Done
Enhanced the master generation prompt to produce higher-quality summaries and career highlights.

### Issues Addressed
- Summary was too short (2 sentences) without narrative structure
- Career highlights were short/punchy but not reframed to JD themes
- Quality score gave false "A" grades to resumes missing critical keywords

### Changes Made

**Summary Requirements** (new section):
- Exactly 4 sentences following narrative arc:
  1. Identity statement (who you are, years of experience)
  2. Macro signature achievement (PATTERN of impact, not single metric)
  3. How you work (approach, methodology, cross-functional style)
  4. Outcome/value (framed in JD language)
- Total length: 50-75 words
- Integrate 2-3 priority keywords naturally

**Career Highlights Requirements** (new section):
- Format: `**[Bold hook phrase]**: [Narrative sentence with context + metric]`
- Total length: 40-55 words per highlight (longer than bullets)
- Bold hook: 8-12 words, echo JD language
- Each highlight MUST include quantified metric
- Use content_long as raw material for more substance

**Self-Check** (updated):
- Expanded from 6 to 10 items
- Added summary word count and narrative arc checks
- Added highlight format and metric checks

### Files Modified
| File | Change |
|------|--------|
| `src/lib/prompts/master-generation.ts` | Added SUMMARY REQUIREMENTS and CAREER HIGHLIGHTS REQUIREMENTS sections |

### Commit
`bad74bd` - feat: enhance summary and career highlights requirements in master prompt

---

### Next Session Focus
1. **Test with real JD** - Generate resume and verify:
   - Summary is 4 sentences, 50-75 words, tells a narrative
   - Career highlights are 40-55 words with bold hooks and metrics
   - Keywords (GTM, SaaS, API, Product Marketing) appear naturally
2. **Quality gate refinement** - Consider adjusting quality check to catch missing keywords
3. **Bug fixes** - Address any issues from testing

---

## V1.5 Session 6 Completed: UI Overhaul

### What Was Done
- Created `OneShotInput` component (JD paste + format selection + generate button)
- Created `OneShotReview` component (full resume preview + side panels)
- Created `ResumePreview` component (clickable sections for refinement)
- Created `ChatRefinement` component (per-section chat refinement)
- Replaced main page with new one-shot flow
- Updated DOCX export to use `generated_resume` (with V1 fallback)

### New UI Flow
```
Page 1: Paste JD → Select Format → [Generate Resume]
                        ↓
Page 2: Full Resume Preview | Quality Score | Gaps | Chat Refinement
                        ↓
                 [Export DOCX]
```

### Files Changed
| File | Change |
|------|--------|
| `src/components/resume/OneShotInput.tsx` | New |
| `src/components/resume/OneShotReview.tsx` | New |
| `src/components/resume/ResumePreview.tsx` | New |
| `src/components/resume/ChatRefinement.tsx` | New |
| `src/app/page.tsx` | Rewritten |
| `src/app/api/export-docx/route.ts` | Modified |

### V1.5 COMPLETE!

The one-shot generation system is now fully implemented:
- Paste JD → Generate complete resume in ~20 seconds
- Quality checks run automatically with auto-fix
- Gaps detected and addressable with one click
- Per-section chat refinement
- DOCX export

---

## V1.5 Session 5 Completed: Quality Gate System

### What Was Done
- Created `src/lib/quality-check.ts`:
  - `runQualityCheck()` - Validates generated resume against quality rules
  - Checks bullet length (error >40 words, warning >35)
  - Checks verb repetition (error within position, warning >2x resume)
  - Checks phrase repetition (warning >2x resume)
  - Checks jargon patterns (warning on compound noun soup)
  - Calculates A-F grade based on errors/warnings
- Created `src/lib/quality-fix.ts`:
  - `autoFixIssues()` - Automatically fixes critical errors
  - Uses Claude to shorten overlong bullets while preserving metrics
- Integrated quality check into `/api/generate-resume`:
  - Runs quality check after generation
  - Auto-fixes critical issues if found
  - Re-runs check after fixes
  - Stores quality score in session
- Created `QualityIndicator` component for UI

### Quality Grade Calculation
| Grade | Criteria |
|-------|----------|
| A | 0 errors, ≤2 warnings |
| B | ≤1 error, ≤4 warnings |
| C | ≤2 errors, ≤6 warnings |
| D | ≤4 errors |
| F | >4 errors |

### Next Session
**V1.5 Session 6: UI Overhaul** — Replace wizard with single-page flow.

See `docs/SESSION_6_UI_OVERHAUL.md` for full session details.

---

## V1.5 Session 4 Completed: Gap Detection + Recommendations

### What Was Done
- Created `src/lib/gap-detection.ts`:
  - `detectGaps()` - Identifies unaddressed priority themes
  - `findReframingOpportunity()` - Uses Claude to find reframable content
  - `addressGap()` - Regenerates affected sections to address a gap
- Created `POST /api/address-gap` - Applies gap recommendation to resume
- Created `POST /api/skip-gap` - Marks a gap as skipped
- Integrated gap detection into `/api/generate-resume` route
- Created `GapRecommendations` component for UI

### Gap Logic
- Only priority themes checked (not secondary)
- Maximum 3 gaps surfaced per generation
- Only gaps with reframing opportunities shown (actionable gaps)
- Uses Claude to identify which existing content could be reframed

### API Endpoints Added
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/address-gap | Apply gap recommendation to resume |
| POST | /api/skip-gap | Mark gap as skipped |

### Next Session
**V1.5 Session 5: Quality Gate System** — Add quality checks and auto-fix for bullets.

See `docs/SESSION_5_QUALITY_GATE.md` for full session details.

---

## V1.5 Session 3 Completed: One-Shot API Route

### What Was Done
- Created `POST /api/generate-resume` — single call generates complete resume
  - Fetches session with JD analysis
  - Converts V1 JDAnalysis to V1.5 EnhancedJDAnalysis format
  - Calls `generateFullResume()` from Session 2
  - Stores generated resume, verbs, and generation version in session
- Created `POST /api/refine` — handles chat-based refinements
  - Supports sections: summary, highlight_N, position_N_overview, position_N_bullet_N
  - Preserves quality rules (40 word max, verb/phrase constraints)
  - Updates specific section while keeping rest of resume intact
- Added `verbs_used` field to `GeneratedResume` type
- Existing V1 routes (`/api/generate-section`, `/api/analyze-jd`) unchanged for backward compatibility

### API Endpoints
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/generate-resume | One-shot full resume generation |
| POST | /api/refine | Chat-based section refinement |
| POST | /api/analyze-jd | JD analysis (unchanged, V1) |
| POST | /api/generate-section | Section generation (unchanged, V1) |

### Next Session
**V1.5 Session 4: Gap Detection + Recommendations** — Add gap detection and content recommendations.

See `docs/SESSION_4_GAP_DETECTION.md` for full session details.

---

## V1.5 Session 2 Completed: Master Generation Prompt

### What Was Done
- Created `src/lib/prompts/master-generation.ts`:
  - `buildMasterGenerationPrompt()` - Builds the one-shot prompt with all quality rules inline
  - `parseGenerationResponse()` - Parses Claude's JSON response into GeneratedResume
  - `mapContentItemToPrompt()` - Maps DB content items to prompt format
  - `PromptContentItem` and `PositionContent` interfaces
- Added to `src/lib/claude.ts`:
  - `generateFullResume()` - One-shot generation function
  - `fetchAllSummaries()` - Fetches summary content from DB
  - `fetchAllCareerHighlights()` - Fetches career highlights from DB
  - `fetchAllPositionContent()` - Fetches position overviews and bullets
- Position metadata already exists in `src/lib/rules.ts` (POSITIONS constant)
- Fixed `tsconfig.json` to exclude scripts folder from build

### Key Prompt Features
- Full JD analysis context (priority/secondary themes, ATS keywords)
- Complete content database injected (summaries, highlights, positions)
- Quality rules inline:
  - 40 word max per bullet (HARD LIMIT)
  - No verb repetition within position
  - Max 2 uses of any verb in entire resume
  - Max 2 uses of any phrase in entire resume
  - No jargon soup (compound noun chains)
  - Preserve all metrics exactly
- Branding rules for competitor handling
- Content version selection based on format (long/short)
- Output: JSON with summary, highlights, positions, themes_addressed, themes_not_addressed, verbs_used, content_ids_used

### Next Session
**V1.5 Session 3: One-Shot API Route** — Build `/api/generate-resume` endpoint that calls the master prompt.

See `docs/SESSION_3_API_ROUTE.md` for full session details.

---

## V1.5 Session 1 Completed: Database + Types

### What Was Done
- Added new types to `src/types/index.ts`:
  - `GeneratedResume` - One-shot resume structure with summary, highlights, positions
  - `GeneratedPosition` - Position data with title, company, dates, location, overview, bullets
  - `Gap` - Gap detection with severity and recommendations
  - `GapRecommendation` - Suggestions for addressing gaps
  - `QualityScore` - A-F grading with keyword/theme alignment percentages
  - `QualityIssue` - Individual quality issues (length, verb repetition, jargon)
  - `EnhancedJDAnalysis`, `JDTheme`, `ContentMapping` - Enhanced JD analysis types
- Updated `src/drizzle/schema.ts`:
  - Added `generated_resume` JSONB column
  - Added `gaps` JSONB column (default: [])
  - Added `quality_score` JSONB column
  - Added `used_verbs` text array column
  - Added `used_phrases` text array column
  - Added `generation_version` text column (default: 'v1')
- Generated migration: `0002_dazzling_karnak.sql`
- Updated Zustand store (`src/lib/store.ts`):
  - Added state: `generatedResume`, `gaps`, `qualityScore`, `isGenerating`
  - Added actions: `setGeneratedResume`, `setGaps`, `setQualityScore`, `updateGapStatus`, `setIsGenerating`, `clearGeneration`

### Migration File
```sql
ALTER TABLE "sessions" ADD COLUMN "generated_resume" jsonb;
ALTER TABLE "sessions" ADD COLUMN "gaps" jsonb DEFAULT '[]'::jsonb;
ALTER TABLE "sessions" ADD COLUMN "quality_score" jsonb;
ALTER TABLE "sessions" ADD COLUMN "used_verbs" text[] DEFAULT '{}';
ALTER TABLE "sessions" ADD COLUMN "used_phrases" text[] DEFAULT '{}';
ALTER TABLE "sessions" ADD COLUMN "generation_version" text DEFAULT 'v1';
```

### Next Session
**V1.5 Session 2: Master Generation Prompt** — Create the one-shot generation prompt with full content database context.

See `docs/V1_5_UPGRADE_PLAN.md` for the full upgrade plan.

---

## Session 5 Completed: Conversation History for All Sections (V1 Upgrade)

### What Was Done
- Added `conversationHistory` state to Zustand store (`Record<string, ConversationMessage[]>`)
- Added `addConversationMessage()` and `clearSectionHistory()` actions
- Added `refineSummary()` function to claude.ts for multi-turn summary refinement
- Added `refineHighlights()` function to claude.ts for multi-turn highlights refinement
- Updated `/api/generate-section/route.ts` to:
  - Handle summary refinement when `currentContent` + `instructions` provided
  - Handle highlights refinement when `currentContent` + `instructions` provided
  - Import and use new `refineSummary` and `refineHighlights` functions
- Updated `ResumeBuilder.tsx`:
  - `handleSummaryGeneration()` now passes `currentContent` and `conversationHistory`
  - `handleHighlightsSelection()` now detects refinement vs initial load and handles accordingly

### How It Works
- Summary and Highlights now follow same pattern as Position refinement
- When user provides feedback, the API receives:
  - `currentContent`: The existing content to refine
  - `instructions`: What the user wants changed
  - `conversationHistory`: Previous messages for context
- Claude uses the conversation history to understand multi-turn refinements

### Next Session
All V1 upgrade sessions are complete. Test the full flow in production.

See `docs/V1_UPGRADE_SESSIONS.md` for full session details.

---

## Session 4 Completed: Rewrite Prompts for Executive Quality

### What Was Done
- Rewrote `generateTailoredContent()` prompt with:
  - CAR bullet structure (Challenge → Action → Result)
  - Good/bad bullet examples to prevent keyword stuffing
  - Keyword density limits (1-2 per bullet, 3-5 per overview)
  - Translation-first approach for keyword integration
- Rewrote `generateSummary()` prompt with:
  - 5-part structure (identity, value prop, proof, method, outcomes)
  - Target of 8-12 keywords naturally integrated
  - "ATS power zone" concept
- Updated `refinePositionContent()` prompt with:
  - Position-level verb tracking (verbs used in current position)
  - Quality standards section
  - CAR method reference
- Updated `regenerateWithKeyword()` prompt with:
  - Translation-first approach
  - Example of proper keyword integration
  - Single keyword addition limit

### Key Prompt Improvements
- Quality over keyword density philosophy embedded in prompts
- Examples of good vs bad bullets prevent keyword stuffing
- Verb tracking now happens at both resume and position level
- Mark tag discipline: 2-4 marks per bullet maximum
- Keywords simplified to top 5 with priority indicators

### Next Session
**Session 5: Conversation Context** — Add conversation history to improve multi-turn refinements.

See `docs/V1_UPGRADE_SESSIONS.md` for full session details.

---

## Session 3 Completed: Wire Verb Tracking to API Routes

### What Was Done
- Updated `/api/generate-section/route.ts`:
  - Fetches `verb_tracker` from session
  - Extracts `allUsedVerbs` from tracker for passing to generation functions
  - Passes `allUsedVerbs` to `generateSummary()`, `refinePositionContent()`, and `generateTailoredContent()`
  - Returns `detectedVerbs` in all response payloads
- Updated `/api/approve-section/route.ts`:
  - Imports `extractVerbsFromContent` from claude.ts
  - Fetches `verb_tracker` from session
  - Extracts verbs from approved content (handles strings and position objects)
  - Updates `verb_tracker.usedVerbs[sectionKey]` with detected verbs
  - Removes used verbs from `verb_tracker.availableVerbs`
  - Saves updated `verb_tracker` to session in all relevant update queries

### Key Implementation Details
- Section keys for verb tracking: `summary`, `highlights`, `position_1`, `position_2`, etc.
- Verb extraction only runs for content sections (skips `format` and `header`)
- Position content extraction handles both `overview` and `bullets` array

### Next Session
**Session 4: Rewrite Generate Prompts (Optional)** — Further prompt improvements if needed.

See `docs/V1_UPGRADE_SESSIONS.md` for full session details.

---

## Session 2 Completed: Verb Tracking in Prompts

### What Was Done
- Added `VERB_PATTERNS` constant with 30+ action verbs
- Added `extractVerbsFromContent()` helper function to detect verbs in generated content
- Updated `generateTailoredContent()` with:
  - `usedVerbs` parameter (optional, for backward compat)
  - Verb constraint block in prompt
- Updated `generateSummary()` with same pattern
- Updated `refinePositionContent()` with same pattern
- All prompts now instruct Claude to avoid reusing verbs
- Committed: `84f661a` "feat: add verb constraints to generation prompts"

### Prompt Verb Constraint Block
```
VERB CONSTRAINTS:
The following verbs have already been used in this resume and MUST NOT be used again:
${usedVerbs.length > 0 ? usedVerbs.join(', ') : 'None yet'}

Choose action verbs from this list that haven't been used:
Built, Developed, Created, Launched, Led, Directed, Grew, Scaled,
Transformed, Architected, Delivered, Executed, Pioneered, Championed,
Designed, Oversaw, Managed, Expanded, Shaped, Crafted, Orchestrated

CRITICAL: Do not start any bullet with a verb from the "already used" list.
```

### Next Session
**Session 3: Wire Verb Tracking to API Routes** — Connect verb tracking through the API layer.

See `docs/V1_UPGRADE_SESSIONS.md` for full session details.

---

## Session 1 Completed: Verb Tracking Infrastructure

### What Was Done
- Added `VerbTracker` interface to `src/types/index.ts`
- Added `verb_tracker` JSONB column to sessions table in `src/drizzle/schema.ts`
- Added `verbTracker` state, `setVerbTracker`, and `updateUsedVerbs` actions to Zustand store
- Generated migration file `0001_even_lady_mastermind.sql`
- Applied migration to production database
- Committed: `8be3d78` "feat: add verb tracking infrastructure"

### VerbTracker Structure
```typescript
interface VerbTracker {
  usedVerbs: Record<string, string[]>;  // verb → sections where used
  availableVerbs: string[];              // 30+ default action verbs
}
```

### Default Verbs (6 categories)
- **Building**: Built, Developed, Created, Established, Launched, Designed
- **Leading**: Led, Directed, Oversaw, Managed, Headed, Guided
- **Growing**: Grew, Scaled, Expanded, Increased, Accelerated, Drove
- **Transforming**: Transformed, Repositioned, Modernized, Revitalized, Redesigned
- **Strategy**: Architected, Defined, Shaped, Crafted, Pioneered, Championed
- **Executing**: Delivered, Executed, Implemented, Activated, Orchestrated

### Next Session
**Session 2: Verb Tracking in Prompts** — Update Claude prompts to receive and respect verb constraints.

See `docs/V1_UPGRADE_SESSIONS.md` for full session details.

---

## Current State

### What's Working
- [x] Two-panel UI (chat + preview)
- [x] 8-step flow
- [x] JD analysis (enhanced with ATS keywords)
- [x] Semantic search with pgvector
- [x] Content tailoring with keyword incorporation
- [x] DOCX export
- [x] Position refinement via chat
- [x] Highlight customizations toggle
- [x] Keywords Panel UI
- [x] Gap reconciliation prompts

### What's In Progress

**Feature**: ATS Keywords & Gap Reconciliation
**Status**: Done - deployed to Vercel
**Files touched**:
- `src/types/index.ts` (created)
- `src/drizzle/schema.ts` (modified)
- `src/lib/rules.ts` (modified)
- `src/lib/claude.ts` (modified)
- `src/lib/store.ts` (modified)
- `src/app/api/analyze-jd/route.ts` (modified)
- `src/app/api/generate-section/route.ts` (modified)
- `src/app/api/keyword-action/route.ts` (created)
- `src/components/resume/KeywordsPanel.tsx` (created)
- `src/components/resume/GapPrompt.tsx` (created)
- `src/components/resume/PreviewPanel.tsx` (modified)
- `src/components/resume/ChatPanel.tsx` (modified)
- `src/components/resume/ResumeBuilder.tsx` (modified)

**What's done**:
- Two-layer JD analysis (strategic positioning + ATS keywords)
- Junior skills filter to exclude tactical keywords
- Keywords Panel with category grouping and status indicators
- Gap reconciliation prompts for unaddressed keywords
- Claude-based semantic detection of addressed keywords
- Database migration applied (jd_analysis JSONB column)
- **Keywords now incorporated in ALL sections** (summary, highlights, positions 1-6)
- **Customization highlighting works across ALL sections** (mark tags rendered)
- Pushed to Vercel

**What's left**:
- End-to-end testing of the full flow in production

---

## Next Up

1. **Test ATS Keywords Flow** — Verify the full user flow works in production
2. **Bug fixes** — Address any issues discovered during testing

---

## Recent Decisions

| Decision | Choice | Why |
|----------|--------|-----|
| Keyword detection method | Claude semantic analysis | More accurate than substring matching for detecting if keywords are naturally incorporated |
| Junior skills filter | Hardcoded list in rules.ts | Simple and effective for executive-level resumes |

---

## Known Issues / Bugs

- None discovered yet (feature just deployed)

---

## Feature Specs Available

| Feature | Spec File | Status |
|---------|-----------|--------|
| Highlight Customizations Toggle | `FEATURE_SPEC_HIGHLIGHT_CUSTOMIZATIONS.md` | Done |
| Enhanced JD Analysis + ATS Keywords | `IMPLEMENTATION_INSTRUCTIONS_JD_ANALYSIS.md` | Done |

---

## Quick Commands

```bash
# Run locally
npm run dev

# Deploy
git push origin main

# Database migration
npx dotenv -e .env.local -- npm run db:migrate
```

---

## Links

- **Live App**: https://resumeos.vercel.app
- **GitHub**: https://github.com/umbic/resumeos

---

## Notes for Next Session

- Read project files first: `unified_content_database_v4.md`, `resume_system_design_v3.md`
- Don't fabricate resume content — only select/reframe from database
- Execute, don't plan. Build incrementally, commit often.
- Test the ATS keywords feature with a real job description
