# ResumeOS V1 Upgrade — Chunked Implementation Plan

> **Strategy**: 5 focused sessions, each with bounded scope
> **Each session**: ~30-45 min, commits before context fills
> **Handoff**: HANDOFF.md updated at end of each session

---

## Session 1: Verb Tracking Infrastructure

**Scope**: Add verb tracking to database and state management only. No prompt changes yet.

**Files to modify**:
- `src/drizzle/schema.ts` — Add verb_tracker column to sessions
- `src/lib/store.ts` — Add verb tracking to Zustand store  
- `src/types/index.ts` — Add VerbTracker interface

**Deliverables**:
```typescript
// New type
interface VerbTracker {
  usedVerbs: Record<string, string[]>; // verb → sections used in
  availableVerbs: string[];
}

// New session column
verb_tracker: jsonb
```

**Prompt for Claude Code**:
```
Read CONTENT_GENERATION_RULES.md section on verb tracking.

Task: Add verb tracking infrastructure (NO prompt changes yet)

1. Add VerbTracker interface to src/types/index.ts
2. Add verb_tracker JSONB column to sessions table in src/drizzle/schema.ts
3. Add verbTracker state to Zustand store in src/lib/store.ts
4. Generate migration: npm run db:generate

Do NOT modify lib/claude.ts or any API routes yet.
Commit when done with message: "feat: add verb tracking infrastructure"
Update HANDOFF.md with what you did.
```

**Success criteria**: Migration runs, types compile, store has verbTracker.

---

## Session 2: Verb Tracking in Prompts

**Scope**: Update Claude prompts to receive and respect verb constraints.

**Files to modify**:
- `src/lib/claude.ts` — All generation functions

**Changes**:
1. Add `usedVerbs: string[]` parameter to generation functions
2. Add verb constraint section to prompts
3. Add verb extraction from generated content

**Prompt for Claude Code**:
```
Read CONTENT_GENERATION_RULES.md sections on:
- Part 3: Action Verb Rules
- Part 10: Prompt Requirements
- Appendix: Verb Tracking Template

Task: Update prompts to enforce verb rules

1. Modify generateTailoredContent() to:
   - Accept usedVerbs parameter
   - Add verb constraint block to prompt
   - Return detected verbs in response

2. Modify generateSummary() same way

3. Modify refinePositionContent() same way

4. Create helper function extractVerbsFromContent(content: string): string[]

Do NOT modify API routes yet - just the lib/claude.ts functions.
Commit: "feat: add verb constraints to generation prompts"
Update HANDOFF.md
```

**Success criteria**: Functions accept usedVerbs, prompts include constraints.

---

## Session 3: Wire Verb Tracking to API Routes

**Scope**: Connect verb tracking through API layer.

**Files to modify**:
- `src/app/api/generate-section/route.ts`
- `src/app/api/approve-section/route.ts`

**Changes**:
1. generate-section: Read verb_tracker from session, pass to Claude
2. approve-section: Extract verbs from approved content, update tracker

**Prompt for Claude Code**:
```
Task: Wire verb tracking through API routes

1. In /api/generate-section/route.ts:
   - Fetch verb_tracker from session
   - Pass usedVerbs to generation functions
   - Include detected verbs in response

2. In /api/approve-section/route.ts:
   - Extract verbs from approved content using extractVerbsFromContent()
   - Update session.verb_tracker with new verbs
   - Save to database

Test by running locally and checking that:
- Verbs are passed to generation
- Approved content updates the tracker

Commit: "feat: wire verb tracking through API layer"
Update HANDOFF.md
```

**Success criteria**: Full loop works - generate respects constraints, approve updates tracker.

---

## Session 4: Rewrite Prompts for Quality

**Scope**: Rewrite all prompts following CONTENT_GENERATION_RULES.md

**Files to modify**:
- `src/lib/claude.ts` — All prompts

**This is the big one.** Focus on:
1. CAR structure for bullets
2. Keyword density limits by section
3. "Translate don't stuff" philosophy
4. Mark tag density limits

**Prompt for Claude Code**:
```
Read CONTENT_GENERATION_RULES.md completely.

Task: Rewrite ALL prompts in lib/claude.ts to follow the rules.

Key changes for each prompt:

1. analyzeJobDescription():
   - Keep as-is, it's already good

2. generateTailoredContent():
   - Add CAR structure requirement for bullets
   - Add keyword density limit (1-2 per bullet)
   - Add "translate don't stuff" instruction
   - Add mark tag density limit

3. generateSummary():
   - Add keyword density limit (8-12 total)
   - Add "this is your ATS power zone" context
   - Emphasize natural integration

4. refinePositionContent():
   - Add verb constraint reminder
   - Add fact preservation emphasis

5. regenerateWithKeyword():
   - Add translation approach
   - Prevent keyword stacking

Test each prompt by generating content and checking quality.
Commit: "refactor: rewrite prompts for executive quality"
Update HANDOFF.md
```

**Success criteria**: Generated content reads naturally, no keyword stuffing.

---

## Session 5: Add Conversation History to All Sections

**Scope**: Make summary and highlights refinable like positions.

**Files to modify**:
- `src/app/api/generate-section/route.ts`
- `src/components/resume/ResumeBuilder.tsx`
- `src/lib/store.ts`

**Changes**:
1. Store conversation history per section in Zustand
2. Pass history to Claude for summary/highlight refinement
3. UI: Allow "refine" action on summary and highlights

**Prompt for Claude Code**:
```
Currently only position refinement has conversation history.
Task: Add conversation history to summary and highlights.

1. In src/lib/store.ts:
   - Add conversationHistory: Record<string, Message[]>
   - Key by section: "summary", "highlights", "position_1", etc.

2. In /api/generate-section/route.ts:
   - Accept conversationHistory in request
   - Pass to Claude for all section types (not just positions)

3. In ResumeBuilder.tsx:
   - Store conversation history when user sends refinement messages
   - Pass to generate-section API calls
   - Allow refinement for summary and highlights (already works for positions)

Commit: "feat: add conversation history to all sections"
Update HANDOFF.md
```

**Success criteria**: Can refine summary/highlights through conversation.

---

## Session Execution Guide

### Before Each Session

1. Pull latest from git
2. Open HANDOFF.md to see where you left off
3. Start fresh Claude Code session (`/clear` if reusing)
4. Give the specific session prompt above

### During Each Session

- Let Claude Code work autonomously
- Check in every 10-15 minutes
- If context gets long, use `/compact`
- Commit frequently (after each working piece)

### After Each Session

1. Make sure Claude Code committed all changes
2. Push to GitHub
3. Verify HANDOFF.md is updated
4. Test the deployed version on Vercel

---

## Time Estimates

| Session | Estimated Time | Complexity |
|---------|---------------|------------|
| 1: Verb Tracking Infra | 30 min | Low |
| 2: Verb Tracking Prompts | 45 min | Medium |
| 3: Wire API Routes | 30 min | Low |
| 4: Rewrite Prompts | 60 min | High |
| 5: Conversation History | 45 min | Medium |
| **Total** | **~3.5 hours** | |

Can be done in 1-2 days with breaks between sessions.

---

## Files to Add to Project Folder

Before starting, add these to your ResumeOS project:

1. `CONTENT_GENERATION_RULES.md` — Already created in previous chat
2. This file (`V1_UPGRADE_SESSIONS.md`)
3. Keep `HANDOFF.md` updated

Claude Code will read these automatically.

---

## Emergency Recovery

If a session goes sideways:

```bash
# See what changed
git status
git diff

# Undo uncommitted changes
git checkout -- .

# Undo last commit but keep changes
git reset --soft HEAD~1

# Nuclear option: reset to last good state
git reset --hard origin/main
```

---

## After V1 Upgrades Complete

Once all 5 sessions are done:
1. Full end-to-end test
2. Generate a resume and check quality
3. Verify no verb repetition
4. Verify keywords feel natural
5. Then we can discuss V2 multi-agent architecture

---

## Quick Reference: What Goes in HANDOFF.md

After each session:

```markdown
## Last Session: [DATE]

### Completed
- [What was built]
- [Files modified]
- [Commits made]

### Current State
- [What's working]
- [What's not working]

### Next Session
- [Which session number]
- [What to do]

### Notes for Claude Code
- [Any gotchas discovered]
- [Decisions made]
```
