# SESSION 4: Rewrite Prompts for Quality

## Context
Read CONTENT_GENERATION_RULES.md COMPLETELY before starting.

This is the most important session. We're rewriting prompts to produce executive-quality content instead of keyword-stuffed ATS fodder.

## Key Principles

1. **Quality over keyword density** — 60% match that reads beautifully > 90% match that sounds robotic
2. **Translate, don't stuff** — Find user's existing language that maps to JD keywords
3. **CAR structure** — Challenge → Action → Result for every bullet
4. **Verb variety** — Never repeat in section, max 2x in entire resume
5. **Mark tag discipline** — Only mark actual customizations, not whole sentences

## Steps

### 1. Update `generateTailoredContent()` prompt:

Replace the prompt with:

```typescript
const prompt = `You are an executive resume writer creating content for a senior brand strategist.

TARGET ROLE: ${jdAnalysis.strategic.targetTitle} at ${jdAnalysis.strategic.targetCompany}
INDUSTRY: ${jdAnalysis.strategic.industry}

POSITIONING THEMES (the story to tell):
${jdAnalysis.strategic.positioningThemes.map(t => `- ${t}`).join('\n')}

KEYWORDS TO INCORPORATE (where natural):
${unaddressedKeywords.slice(0, 5).map(k => `- ${k.keyword} (${k.priority})`).join('\n')}

---

ORIGINAL CONTENT:
${originalContent}

---

CRITICAL INTEGRITY RULES (violations are unacceptable):
1. NEVER change any metrics, numbers, or percentages
2. NEVER add industries, sectors, or client types not in the original
3. NEVER fabricate capabilities, experiences, or outcomes
4. NEVER inflate scope, scale, or impact beyond what's stated

VERB CONSTRAINTS:
Already used (DO NOT USE): ${usedVerbs.join(', ') || 'None'}
Choose from: Built, Developed, Created, Launched, Led, Directed, Grew, Scaled, Transformed, Architected, Delivered, Executed, Pioneered

BULLET STRUCTURE (CAR Method):
Each bullet must follow: [Action Verb] + [What/Challenge] + [How/Method] + [Result/Metrics]

Example of GOOD bullet:
"Built creator commerce platform's first global brand strategy post-$300M investment, launching multi-channel campaign that drove 8% customer acquisition"

Example of BAD bullet:
"Spearheaded go-to-market leveraging data-driven strategies and cross-functional stakeholder management" (vague, keyword-stuffed)

KEYWORD INTEGRATION:
- Density limit: 1-2 keywords per bullet, 3-5 per overview
- TRANSLATE user's language to JD terminology, don't just insert keywords
- Example: User says "shifted CRM focus" → Integrate as "customer-centric transformation"
- If keyword doesn't authentically apply, SKIP IT

CUSTOMIZATION MARKING:
- Wrap ONLY actual changes in <mark> tags
- Do NOT mark entire sentences
- Do NOT mark original text that happens to match JD
- Aim for 2-4 marks per bullet maximum

${instructions ? `ADDITIONAL INSTRUCTIONS: ${instructions}` : ''}

Return ONLY the tailored content with <mark> tags.`;
```

### 2. Update `generateSummary()` prompt:

```typescript
const prompt = `Create an executive summary for a senior brand strategist resume.

TARGET: ${jdAnalysis.strategic.targetTitle} at ${jdAnalysis.strategic.targetCompany}
INDUSTRY: ${jdAnalysis.strategic.industry}
FORMAT: ${format} (${format === 'long' ? '4-5 sentences' : '3-4 sentences'})

POSITIONING THEMES:
${jdAnalysis.strategic.positioningThemes.map(t => `- ${t}`).join('\n')}

ATS KEYWORDS (this is your power zone - aim for 8-12 naturally integrated):
${unaddressedKeywords.map(k => `- ${k.keyword}`).join('\n')}

---

SOURCE CONTENT (combine and reframe from these ONLY):

${summaryOptions.map((s, i) => `Option ${i + 1}:\n${s}`).join('\n\n')}

---

RULES:
1. Use ONLY facts, claims, and phrases from the source content
2. Never invent industries, capabilities, or experiences
3. Lead with the most relevant capability for this role
4. The summary is your ATS power zone - keywords should feel invisible, not forced

STRUCTURE:
1. Identity statement (who you are + years + expertise)
2. Value proposition (what you do for organizations)
3. Proof points (types of companies served)
4. Method (how you approach work)
5. Outcome focus (results you deliver)

VERB CONSTRAINTS:
Already used: ${usedVerbs.join(', ') || 'None'}

Mark customizations with <mark> tags. Only mark actual changes.

Return ONLY the summary text.`;
```

### 3. Update `refinePositionContent()` prompt:

Add these sections to the existing prompt:

```typescript
// Add after Key Themes line:
QUALITY STANDARDS:
- Every bullet must have a quantified result
- No verb can repeat within this position
- Keyword density: 1-2 per bullet maximum
- If user asks for something not in original content, explain you cannot invent facts

VERB CONSTRAINTS:
Already used in resume: ${usedVerbs.join(', ') || 'None'}
Already used in THIS position: ${positionVerbs.join(', ') || 'None'}
```

### 4. Update `regenerateWithKeyword()` prompt:

```typescript
const prompt = `Incorporate a specific keyword into resume content through TRANSLATION, not insertion.

KEYWORD TO ADD: "${keyword.keyword}"
USER CONTEXT: "${userContext}"

CURRENT CONTENT:
${currentContent}

TARGET: ${jdAnalysis.strategic.targetTitle} at ${jdAnalysis.strategic.targetCompany}

APPROACH:
1. Find where user's existing language can be TRANSLATED to include this keyword
2. The keyword should feel like it was always there, not inserted
3. If the user context doesn't provide a legitimate basis, explain why you can't add it

RULES:
- Maintain all existing metrics and facts
- One keyword addition only - don't stack multiple keywords
- Preserve existing <mark> tags
- Wrap the newly added keyword phrase in <mark> tags

Example:
- Original: "shifted CRM approach to focus on retention"
- Keyword: "customer-centric"
- Result: "Led <mark>customer-centric</mark> transformation of CRM, shifting focus to retention"

Return ONLY the updated content.`;
```

### 5. Test each prompt:

For each section type:
1. Generate content
2. Read it aloud - does it sound natural?
3. Count keyword density - within limits?
4. Check verb variety - no repeats?
5. Verify facts unchanged from source

## Commit
```bash
git add .
git commit -m "refactor: rewrite prompts for executive quality"
```

## Update HANDOFF.md

## Success Criteria
- [ ] Generated summaries have 8-12 keywords naturally integrated
- [ ] Bullets follow CAR structure
- [ ] No verb repetition within sections
- [ ] Mark tags used sparingly (2-4 per bullet)
- [ ] Content reads naturally when spoken aloud
- [ ] No keyword stuffing patterns like "leveraging data-driven strategies"
