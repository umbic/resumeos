# ResumeOS Prompt Audit Results

**Audit Date:** 2026-01-02
**Files Reviewed:** 6
**Claude API Calls Found:** 6
**OpenAI API Calls:** 1 (embeddings only)

---

## Summary of Findings

| Prompt | File | Has System Prompt | Has Conversation History | Verb Tracking |
|--------|------|-------------------|-------------------------|---------------|
| JD Analysis | `lib/claude.ts:39-143` | ❌ No | ❌ No | ❌ No |
| Tailored Content | `lib/claude.ts:211-255` | ❌ No | ❌ No | ❌ No |
| Summary Generation | `lib/claude.ts:289-329` | ❌ No | ❌ No | ❌ No |
| Position Refinement | `lib/claude.ts:424-428` | ❌ No (pseudo) | ✅ Yes (last 20 msgs) | ❌ No |
| Keyword Detection | `lib/claude.ts:457-483` | ❌ No | ❌ No | N/A |
| Keyword Regeneration | `lib/claude.ts:509-543` | ❌ No | ❌ No | ❌ No |

### Critical Issues Identified

1. **No verb tracking** - Each section generated independently, causing "spearheaded" 5x problem
2. **No true system prompt** - All context in user messages (less stable)
3. **Keyword integration guidance is weak** - Says "where natural" but no structural guidance on placement
4. **Most prompts are stateless** - Only position refinement has conversation history
5. **No tracking of what was already generated** - Can't ensure variety across sections

---

## Prompt 1: JD Analysis

**File:** `src/lib/claude.ts`
**Function:** `analyzeJobDescription()`
**Lines:** 39-143
**Purpose:** Extract strategic positioning themes and ATS keywords from job description

### System Prompt
None - all instructions in user message

### User Prompt (Full Template)

```
Analyze this job description and extract TWO types of information:

---

## PART 1: STRATEGIC POSITIONING

1. **Target Job Title**: The exact title as it should appear on the resume header
2. **Target Company**: Company name
3. **Industry/Sector**: Primary industry (e.g., "Financial Services", "Healthcare", "Technology")
4. **Positioning Themes**: 3-5 strategic angles to emphasize throughout the resume. These are the "story" the resume should tell — not keywords, but narrative directions.

Example positioning themes:
- "Transformation leader who modernizes legacy brands"
- "Data-informed strategist who connects brand to revenue"
- "Cross-functional executive who aligns marketing with business goals"

---

## PART 2: ATS KEYWORD EXTRACTION

Extract keywords an ATS would scan for, filtered for **executive-level relevance**.

IMPORTANT FILTERING RULES:
- SKIP junior/tactical skills (Excel, PowerPoint, SQL, HTML, CSS, Google Analytics, etc.)
- SKIP tool-level proficiencies unless strategic (e.g., keep "Salesforce ecosystem strategy", skip "Salesforce admin")
- FOCUS on strategic, leadership, and domain expertise keywords
- This is for a senior executive resume — keywords should reflect VP/SVP/C-suite level work

### Categories to Extract:

**1. Hard Skills** (strategic/leadership abilities)
Examples: brand strategy, go-to-market planning, P&L management, executive communications, portfolio architecture, campaign strategy, customer segmentation, market positioning

**2. Soft Skills** (executive-level interpersonal skills)
Examples: executive presence, stakeholder management, cross-functional leadership, board communication, change management, team building

**3. Industry Terms** (sector-specific vocabulary)
Examples: wealth management, B2B, omnichannel, DTC, AUM, customer lifetime value, brand equity, retail banking

**4. Seniority Signals** (level indicators)
Examples: years of experience mentioned, level words like "senior", "director", "VP", "head of", team size expectations, budget/P&L responsibility

For each keyword, provide:
- **keyword**: Exact phrase from JD
- **category**: hard_skill | soft_skill | industry_term | seniority_signal
- **priority**: high | medium | low (based on frequency and placement in JD)
- **placement**: Where it appeared (title, requirements, responsibilities, nice-to-have)

---

## BRANDING RECOMMENDATION

Also determine if "generic" branding should be used (hide competitor names like Deloitte, Omnicom) if the target company is:
McKinsey, BCG, Bain, Accenture, EY, KPMG, PwC, WPP, Publicis, IPG, or Dentsu

---

## OUTPUT FORMAT

Return as JSON:

{
  "strategic": {
    "targetTitle": "Head of Brand Strategy",
    "targetCompany": "Morgan Stanley",
    "industry": "Financial Services - Wealth Management",
    "positioningThemes": [
      "Enterprise brand transformation leader",
      "Wealth/financial services domain expertise",
      "Cross-functional executive who partners with business leaders"
    ]
  },
  "keywords": [
    {
      "keyword": "brand strategy",
      "category": "hard_skill",
      "priority": "high",
      "placement": "title, requirements"
    },
    {
      "keyword": "wealth management",
      "category": "industry_term",
      "priority": "high",
      "placement": "throughout"
    }
  ],
  "recommendedBrandingMode": "branded",
  "reasoning": "Morgan Stanley is not a direct competitor to Deloitte or Omnicom agencies"
}

---

Job Description:
${jobDescription}

Return ONLY the JSON object, no other text.
```

### Variables Interpolated
- `${jobDescription}` - Raw JD text pasted by user

### Response Format Expected
JSON object with `strategic`, `keywords`, `recommendedBrandingMode`, `reasoning`

### Issues Identified
- [ ] No conversation history
- [ ] No system prompt (all in user message)
- [ ] Good keyword categorization but no guidance on distribution strategy
- [ ] Doesn't extract tone/voice preferences from JD

---

## Prompt 2: Tailored Content Generation

**File:** `src/lib/claude.ts`
**Function:** `generateTailoredContent()`
**Lines:** 186-263
**Purpose:** Tailor individual content items (bullets, highlights) for the target role

### System Prompt
None

### User Prompt (Full Template)

```
Tailor this resume content for a specific job application. You must preserve all facts from the original.

Target Role: ${jdAnalysis.strategic.targetTitle} at ${jdAnalysis.strategic.targetCompany}
Industry: ${jdAnalysis.strategic.industry}

**Positioning Themes** (story to tell):
${jdAnalysis.strategic.positioningThemes.map((t) => `- ${t}`).join('\n')}

**ATS Keywords to Mirror** (where natural and authentic):
- Hard Skills: ${keywordsByCategory.hard_skills.join(', ')}
- Soft Skills: ${keywordsByCategory.soft_skills.join(', ')}
- Industry Terms: ${keywordsByCategory.industry_terms.join(', ')}

ORIGINAL CONTENT (${sectionType}):
${originalContent}

${instructions ? `Additional Instructions: ${instructions}` : ''}

CRITICAL RULES - VIOLATIONS ARE UNACCEPTABLE:
1. NEVER change any metrics, numbers, or percentages
2. NEVER add industries, sectors, or client types not in the original
3. NEVER fabricate capabilities, experiences, or outcomes
4. NEVER inflate scope, scale, or impact beyond what's stated
5. If the target industry isn't mentioned in the original, do NOT add it

ALLOWED CUSTOMIZATIONS:
- Reorder emphasis within the sentence
- Use synonyms that don't change meaning (e.g., "led" → "spearheaded")
- Mirror JD terminology ONLY where it authentically maps to existing content
- Slight rephrasing that preserves all original claims
- Naturally incorporate ATS keywords where they genuinely apply

When you incorporate a JD keyword, wrap it in <mark> tags so we can highlight it.
Wrap other customized words/phrases in <mark> tags too. Only mark actual changes.

Example:
Original: "Led brand strategy initiatives across multiple sectors"
CORRECT: "Led <mark>brand transformation</mark> initiatives across multiple sectors"
WRONG: "Led brand strategy initiatives across <mark>financial services and payments</mark>" (invents industries)

Return ONLY the tailored content with <mark> tags inline.
```

### Variables Interpolated
- `${jdAnalysis.strategic.targetTitle}` - Target job title
- `${jdAnalysis.strategic.targetCompany}` - Target company name
- `${jdAnalysis.strategic.industry}` - Target industry
- `${jdAnalysis.strategic.positioningThemes}` - Array of themes (joined with newlines)
- `${keywordsByCategory.hard_skills}` - Hard skill keywords (comma-separated)
- `${keywordsByCategory.soft_skills}` - Soft skill keywords (comma-separated)
- `${keywordsByCategory.industry_terms}` - Industry keywords (comma-separated)
- `${originalContent}` - The source content to tailor
- `${sectionType}` - Type of section (bullet, career_highlight, etc.)
- `${instructions}` - Optional additional instructions

### Response Format Expected
Plain text with `<mark>` tags around customizations

### Issues Identified
- [ ] **No verb tracking** - "spearheaded" can be used multiple times
- [ ] No conversation history - each item tailored independently
- [ ] "Use synonyms" example explicitly shows "led" → "spearheaded" (encourages the problem!)
- [ ] Keyword instruction says "where natural" but gives no structural guidance
- [ ] Doesn't know what was already generated in other sections

---

## Prompt 3: Summary Generation

**File:** `src/lib/claude.ts`
**Function:** `generateSummary()`
**Lines:** 265-337
**Purpose:** Generate executive summary from multiple source options

### System Prompt
None

### User Prompt (Full Template)

```
Combine and tailor a professional summary for a resume using ONLY the source content provided.

Target Role: ${jdAnalysis.strategic.targetTitle} at ${jdAnalysis.strategic.targetCompany}
Industry: ${jdAnalysis.strategic.industry}

**Positioning Themes** (story to tell):
${jdAnalysis.strategic.positioningThemes.map((t) => `- ${t}`).join('\n')}

**ATS Keywords to Mirror** (where natural and authentic):
- Hard Skills: ${keywordsByCategory.hard_skills.join(', ')}
- Soft Skills: ${keywordsByCategory.soft_skills.join(', ')}
- Industry Terms: ${keywordsByCategory.industry_terms.join(', ')}

Format: ${format} (${format === 'long' ? '4-5 sentences' : '3-4 sentences'})

SOURCE CONTENT (use ONLY phrases, claims, and facts from these):

Option 1:
${summaryOptions[0]}

Option 2:
${summaryOptions[1]}
...

CRITICAL RULES - VIOLATIONS ARE UNACCEPTABLE:
1. NEVER invent industries, sectors, or domains not explicitly mentioned in the source content
2. NEVER add client types, company types, or verticals not in the source (e.g., don't add "payments technology" if not in source)
3. NEVER fabricate capabilities, experiences, or outcomes not stated in the source
4. You may ONLY reorder, combine, and slightly rephrase content from the source options
5. If the target industry isn't represented in the source content, use general business language instead of inventing specifics

ALLOWED CUSTOMIZATIONS:
- Reorder sentences to lead with most relevant capability
- Combine phrases from different source options
- Use synonyms (e.g., "organizations" → "enterprises")
- Mirror terminology from the JD that maps to existing source content
- Naturally incorporate ATS keywords where they genuinely apply to the source content

When you incorporate a JD keyword, wrap it in <mark> tags so we can highlight it.
Wrap other customized words/phrases in <mark> tags too. Only mark actual changes.

Return ONLY the summary text with <mark> tags inline.
```

### Variables Interpolated
- `${jdAnalysis.strategic.targetTitle}` - Target job title
- `${jdAnalysis.strategic.targetCompany}` - Target company
- `${jdAnalysis.strategic.industry}` - Target industry
- `${jdAnalysis.strategic.positioningThemes}` - Positioning themes
- `${keywordsByCategory.*}` - Keyword categories
- `${format}` - "long" or "short"
- `${summaryOptions}` - Array of source summary texts

### Response Format Expected
Plain text with `<mark>` tags

### Issues Identified
- [ ] **No verb tracking** - Can use same verbs as later sections
- [ ] No memory of what summary was approved when generating later sections
- [ ] "Use synonyms" encourages verb repetition without tracking
- [ ] Keyword stuffing risk - lists all keywords with only "where natural" guidance

---

## Prompt 4: Position Refinement (Has Conversation History!)

**File:** `src/lib/claude.ts`
**Function:** `refinePositionContent()`
**Lines:** 344-446
**Purpose:** Refine position overview and bullets based on user feedback

### System Prompt (Pseudo - in first user message)

```
You are helping refine position content on a resume based on user feedback.

Target Role: ${jdAnalysis.strategic.targetTitle} at ${jdAnalysis.strategic.targetCompany}
Industry: ${jdAnalysis.strategic.industry}
Key Themes: ${jdAnalysis.strategic.positioningThemes.join(', ')}

**ATS Keywords to Mirror** (where natural and authentic):
- Hard Skills: ${keywordsByCategory.hard_skills.join(', ')}
- Soft Skills: ${keywordsByCategory.soft_skills.join(', ')}
- Industry Terms: ${keywordsByCategory.industry_terms.join(', ')}

Current Overview:
${overview}

Current Bullets:
1. ${bullets[0]}
2. ${bullets[1]}
...

CRITICAL RULES - VIOLATIONS ARE UNACCEPTABLE:
1. NEVER change any metrics, numbers, or percentages
2. NEVER add industries, sectors, or client types not already in the content
3. NEVER fabricate capabilities, experiences, or outcomes
4. NEVER inflate scope, scale, or impact beyond what's stated
5. If asked to add something not in the original content, politely explain you cannot invent facts

Apply the user's requested changes while maintaining all factual accuracy.
Also try to naturally incorporate ATS keywords where they genuinely apply.

Wrap customized words/phrases in <mark> tags. Preserve existing <mark> tags if that text remains customized.
When you incorporate a JD keyword, wrap it in <mark> tags so we can highlight it.

Return a JSON object with:
{
  "overview": "the updated overview text with <mark> tags",
  "bullets": ["bullet 1 with <mark>tags</mark>", "bullet 2", ...]
}

If the user's request only affects bullets, keep the overview the same.
If the user's request only affects the overview, keep the bullets the same.

Return ONLY the JSON object, no other text.
```

### Conversation History Implementation

**This is the ONLY prompt that maintains conversation history!**

```typescript
// Build messages array with conversation history
const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [
  { role: 'user', content: systemContext },
  { role: 'assistant', content: 'I understand. I will help you refine this position content. What changes would you like me to make?' },
];

// Add conversation history if provided (last 10 exchanges max)
if (conversationHistory && conversationHistory.length > 0) {
  const recentHistory = conversationHistory.slice(-20); // Last 20 messages (10 exchanges)
  for (const msg of recentHistory) {
    messages.push({ role: msg.role, content: msg.content });
  }
}

// Add the current instruction
messages.push({ role: 'user', content: instructions });
```

### Message Flow
1. User message: System context + current content + rules
2. Assistant message: "I understand. I will help you refine..."
3. [Last 20 messages from conversation history]
4. User message: Current instruction

### Response Format Expected
JSON: `{ "overview": "...", "bullets": ["...", "..."] }`

### Issues Identified
- [ ] **No verb tracking** - Even with history, doesn't track verbs used
- [ ] System context is in user message, not true system prompt
- [ ] History only for THIS position - doesn't see summary/highlights
- [ ] Can still repeat verbs from other sections

---

## Prompt 5: Keyword Detection

**File:** `src/lib/claude.ts`
**Function:** `detectAddressedKeywords()`
**Lines:** 449-499
**Purpose:** Check which JD keywords were incorporated in generated content

### System Prompt
None

### User Prompt (Full Template)

```
Analyze the following resume content and determine which of the provided keywords have been incorporated (either exactly or semantically).

RESUME CONTENT:
${content}

KEYWORDS TO CHECK:
- kw_001: "brand strategy"
- kw_002: "P&L management"
...

For each keyword, determine if it has been addressed in the content. A keyword is "addressed" if:
1. The exact phrase appears in the content, OR
2. A clear semantic equivalent appears (e.g., "P&L management" addressed by "managed a $40M P&L")

Return a JSON array of the keyword IDs that have been addressed:
["kw_001", "kw_003", ...]

If no keywords were addressed, return an empty array: []

Return ONLY the JSON array, no other text.
```

### Variables Interpolated
- `${content}` - The generated resume content
- `${keywords}` - Array of JDKeyword objects with id and keyword text

### Response Format Expected
JSON array of keyword IDs: `["kw_001", "kw_003"]`

### Issues Identified
- [ ] This is a good utility function
- [ ] Could be enhanced to track WHERE keywords were placed
- [ ] No verb tracking aspect

---

## Prompt 6: Keyword Regeneration

**File:** `src/lib/claude.ts`
**Function:** `regenerateWithKeyword()`
**Lines:** 502-551
**Purpose:** Regenerate content to incorporate a specific missing keyword

### System Prompt
None

### User Prompt (Full Template)

```
The user wants to include a specific JD keyword in their resume content.

Keyword: "${keyword.keyword}"
User context: "${userContext}"

Current content:
${currentContent}

Target Role: ${jdAnalysis.strategic.targetTitle} at ${jdAnalysis.strategic.targetCompany}
Industry: ${jdAnalysis.strategic.industry}
Section: ${sectionType}

Reframe the content to naturally incorporate this keyword/concept, using the user's context.

CRITICAL RULES:
1. Integrate naturally — don't force it or keyword stuff
2. Maintain all existing metrics and facts
3. Mirror the JD terminology where authentic
4. NEVER change any numbers, percentages, or quantified outcomes
5. NEVER add industries or experiences not in the original content
6. Only add the keyword if the user's context provides a legitimate basis for it

Wrap the newly incorporated keyword in <mark> tags to highlight it.
Preserve any existing <mark> tags on other customizations.

Return ONLY the updated content with <mark> tags inline.
```

### Variables Interpolated
- `${keyword.keyword}` - The specific keyword to incorporate
- `${userContext}` - User explanation of how they have this skill
- `${currentContent}` - Current section content
- `${jdAnalysis.strategic.*}` - Target role info
- `${sectionType}` - Type of section

### Response Format Expected
Plain text with `<mark>` tags

### Issues Identified
- [ ] **No verb tracking** - Can introduce repeated verbs
- [ ] Stateless - doesn't know what's in other sections
- [ ] Good anti-hallucination rules

---

## API Route Analysis

### `app/api/analyze-jd/route.ts`
- Calls: `analyzeJobDescription(jobDescription)`
- No conversation history passed
- Creates new session in DB

### `app/api/generate-section/route.ts`
- Calls: `generateSummary()`, `generateTailoredContent()`, `refinePositionContent()`, `detectAddressedKeywords()`
- **Only `refinePositionContent` receives conversation history**
- Filters history to text-only messages before passing

### `app/api/keyword-action/route.ts`
- Calls: `regenerateWithKeyword()`
- No conversation history passed

### `app/api/approve-section/route.ts`
- **No Claude calls** - Just database operations
- Tracks used/blocked content IDs
- Updates session state

---

## Conversation History Deep Dive

### Q1: Is there a conversation/message history being maintained?

**Partial Yes** - Only for position refinement.

```typescript
// In generate-section/route.ts, lines 124-132:
const filteredHistory: ConversationMessage[] = conversationHistory
  ? conversationHistory
      .filter((msg) => msg.content && !msg.options) // Remove option-selection messages
      .map((msg) => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      }))
  : [];
```

The frontend passes `conversationHistory` only for position refinement requests.

### Q2: Is there a system prompt that persists?

**No** - Each call embeds context in the user message. The "system context" for position refinement is actually the first user message, not a true system prompt.

### Q3: Does refinement work?

**Partially** - For position refinement only:
- User can say "make it more concise" and Claude has context
- Limited to last 20 messages (10 exchanges)
- But doesn't have memory of summary/highlights when refining positions

**For other sections**: No. Each summary/highlight is generated independently.

---

## Root Cause Analysis: The Problems You Reported

### Problem 1: "Spearheaded" used 5x

**Root Cause:**
1. No verb tracking across sections
2. Each content piece generated independently
3. Prompt example explicitly shows `"led" → "spearheaded"` as allowed
4. No list of "verbs already used" passed to any prompt

### Problem 2: Keyword stuffing

**Root Cause:**
1. All keywords listed in every prompt with weak guidance ("where natural")
2. No guidance on distribution (e.g., "use each keyword once across the resume")
3. No section-specific keyword allocation

### Problem 3: Doesn't feel conversational

**Root Cause:**
1. Most prompts are stateless (5 of 6)
2. Only position refinement has history
3. Summary/highlights can't be refined conversationally

### Problem 4: Refinement may not work properly

**Root Cause:**
1. Works for positions (has history)
2. Broken for summary/highlights (no history passed)
3. Cross-section refinement impossible (no global state)

---

## Recommended Fixes

### 1. Add Verb Tracking
```typescript
// Pass to every content generation prompt:
const usedVerbs = ['spearheaded', 'orchestrated', 'led'];
// In prompt: "DO NOT use these verbs (already used): ${usedVerbs.join(', ')}"
```

### 2. Add System Prompt
```typescript
const systemPrompt = `You are a resume writing assistant...`;
messages: [
  { role: 'system', content: systemPrompt },
  { role: 'user', content: specificRequest }
]
```

### 3. Add Keyword Distribution Strategy
```
// In JD analysis, add:
"keywordPlacements": {
  "summary": ["brand strategy", "transformation"],
  "highlights": ["P&L management", "cross-functional"],
  "position1": ["stakeholder management", "go-to-market"]
}
```

### 4. Pass Resume Context to All Calls
```typescript
const resumeContext = {
  approvedSummary: "...",
  approvedHighlights: [...],
  usedVerbs: [...],
  addressedKeywords: [...]
};
```

---

## Files Changed / Not Changed

| File | Has Claude Calls | Needs Changes |
|------|-----------------|---------------|
| `lib/claude.ts` | ✅ 6 functions | ✅ All prompts need revision |
| `lib/openai.ts` | ❌ (embeddings only) | ❌ No changes |
| `api/analyze-jd/route.ts` | ✅ Calls `analyzeJobDescription` | ⚠️ May need verb tracking init |
| `api/generate-section/route.ts` | ✅ Multiple calls | ✅ Add verb tracking, history |
| `api/keyword-action/route.ts` | ✅ Calls `regenerateWithKeyword` | ✅ Add verb tracking |
| `api/approve-section/route.ts` | ❌ No Claude calls | ⚠️ Track verbs on approval |

---

## Next Steps

Per the audit request, the next phase is to:

1. **Rewrite each prompt** following `CONTENT_GENERATION_RULES.md`
2. **Add verb tracking** across all sections
3. **Add proper conversation history** for all refinable sections
4. **Fix keyword integration** with distribution strategy
5. **Add resume context** passing to all generation calls
