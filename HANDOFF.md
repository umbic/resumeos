# ResumeOS - Session Handoff

> **Last Updated**: 2026-01-03
> **Last Session**: Session 5 - Conversation History for All Sections (V1 Upgrade)

---

## Session 5 Completed: Conversation History for All Sections

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
