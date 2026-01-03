# PROMPT AUDIT REQUEST

## What We Need

Extract and document ALL Claude prompts currently used in ResumeOS. We need to see exactly what's being sent to Claude at each step.

---

## Files to Check

Look in these locations for any `anthropic` or Claude API calls:

```
app/api/analyze-jd/route.ts
app/api/generate-section/route.ts
app/api/approve-section/route.ts
app/api/keyword-action/route.ts
lib/claude.ts
lib/openai.ts (for embeddings)
```

And any other files that call the Anthropic API.

---

## For Each Prompt Found, Document:

### 1. Location
- File path
- Function name
- Line numbers

### 2. Purpose
- What step in the flow is this?
- What is it trying to accomplish?

### 3. Full Prompt Text
- Copy the ENTIRE prompt, including any template literals
- Show what variables are being interpolated

### 4. Context Passed
- What data is included? (JD, original content, previous sections, etc.)
- Is conversation history passed?
- Is there a system prompt?

### 5. Response Handling
- How is the response parsed?
- What format is expected?

---

## Output Format

Create a file called `PROMPT_AUDIT_RESULTS.md` with this structure:

```markdown
# ResumeOS Prompt Audit

## Prompt 1: JD Analysis
**File:** `app/api/analyze-jd/route.ts`
**Lines:** 45-78
**Purpose:** Extract strategic positioning and ATS keywords from job description

### System Prompt
[paste system prompt if any]

### User Prompt
[paste full prompt template]

### Variables Interpolated
- `jobDescription`: The raw JD text pasted by user

### Response Format Expected
JSON with structure: { strategic: {...}, keywords: [...] }

### Issues Identified
- [ ] No conversation history
- [ ] Missing verb tracking
- etc.

---

## Prompt 2: Summary Generation
...
```

---

## Conversation History Question

Specifically investigate:

1. **Is there a conversation/message history being maintained?**
   - Look for arrays of `{ role: "user" | "assistant", content: "..." }`
   - Check if previous messages are passed to subsequent calls

2. **Is there a system prompt that persists?**
   - Or is each API call completely standalone?

3. **Does refinement work?**
   - When user says "make it more concise", does Claude have context of what it just generated?

---

## Why This Matters

The current output has problems:
- "Spearheaded" used 5x (no verb tracking)
- Keyword stuffing (prompts probably say "include as many keywords as possible")
- Doesn't feel conversational (probably stateless)
- Refinement may not work properly (no context)

We need to see the prompts to fix them.

---

## After Audit

Once we have the audit, we will:
1. Rewrite each prompt following `CONTENT_GENERATION_RULES.md`
2. Add proper conversation history management
3. Add verb tracking across sections
4. Fix keyword integration guidance

---

## EXECUTE NOW

1. Find all Claude API calls in the codebase
2. Document each one per the format above
3. Create `PROMPT_AUDIT_RESULTS.md`
4. Report back what you found
