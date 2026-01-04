# Session 2: Master Generation Prompt

> **Time**: 60 minutes
> **Scope**: Create the one-shot generation prompt that produces a complete resume
> **This is the most critical session**

---

## Context

This prompt is the heart of V1.5. It receives:
- Full JD analysis (themes, keywords)
- Complete content database
- All quality rules

And outputs:
- Complete resume (summary, highlights, all positions)
- List of themes addressed
- List of themes NOT addressed (for gap detection)

---

## Task 1: Create Master Prompt File

**File**: `src/lib/prompts/master-generation.ts`

```typescript
import { EnhancedJDAnalysis, GeneratedResume } from '@/types';

interface MasterPromptInput {
  jdAnalysis: EnhancedJDAnalysis;
  summaries: ContentItem[];
  careerHighlights: ContentItem[];
  positionContent: PositionContent[];
  format: 'long' | 'short';
  brandingMode: 'branded' | 'generic';
  targetCompany: string;
}

interface ContentItem {
  id: string;
  content_short: string;
  content_medium: string;
  content_long: string;
  content_generic?: string;
  brand_tags: string[];
  category_tags: string[];
  function_tags: string[];
  outcome_tags: string[];
}

interface PositionContent {
  position: number;
  title: string;
  company: string;
  dates: string;
  location: string;
  overview: ContentItem;
  bullets: ContentItem[];
}

export function buildMasterGenerationPrompt(input: MasterPromptInput): string {
  const {
    jdAnalysis,
    summaries,
    careerHighlights,
    positionContent,
    format,
    brandingMode,
    targetCompany,
  } = input;

  // Determine which companies need generic treatment
  const competitorCompanies = getCompetitors(targetCompany);

  return `You are generating a complete executive resume tailored to a specific job description.

## JOB DESCRIPTION ANALYSIS

**Target Role**: ${jdAnalysis.target_title}
**Target Company**: ${jdAnalysis.target_company}

### PRIORITY THEMES (Must Address)
${jdAnalysis.priority_themes.map((t, i) => `${i + 1}. **${t.theme}**
   - Why it matters: ${t.jd_evidence}`).join('\n')}

### SECONDARY THEMES (Address If Natural)
${jdAnalysis.secondary_themes.map(t => `- ${t.theme}`).join('\n')}

### ATS KEYWORDS (Incorporate Naturally)
${jdAnalysis.ats_keywords.join(', ')}

---

## YOUR TASK

Generate a COMPLETE resume with these sections:
1. **Summary**: 3-4 sentences maximum
2. **Career Highlights**: Exactly 5 bullets
3. **Position 1**: Overview + ${format === 'long' ? '4' : '0'} bullets
4. **Position 2**: Overview + ${format === 'long' ? '3' : '0'} bullets
5. **Positions 3-6**: Overview only (no bullets)

---

## CONTENT DATABASE

You must SELECT from and RESHAPE the content below. 
**CRITICAL**: Never invent metrics, clients, or claims. Only reshape existing content.

### AVAILABLE SUMMARIES
${JSON.stringify(summaries, null, 2)}

### AVAILABLE CAREER HIGHLIGHTS
${JSON.stringify(careerHighlights, null, 2)}

### POSITION CONTENT
${positionContent.map(p => `
#### POSITION ${p.position}: ${p.title} at ${p.company}
**Dates**: ${p.dates}
**Location**: ${p.location}

**Overview Options**:
${JSON.stringify(p.overview, null, 2)}

**Bullet Options**:
${JSON.stringify(p.bullets, null, 2)}
`).join('\n')}

---

## RESHAPING RULES

### 1. NARRATIVE ALIGNMENT
- Reframe content to address JD priority themes
- Lead with what matters most to THIS role
- Translate YOUR language to THEIR terminology
- Example: If JD says "enterprise buyer journeys", reframe CRM work as "buyer journey acceleration"

### 2. WHAT YOU CAN CHANGE
✅ Action verbs (vary them — never repeat within a section)
✅ Adjectives and descriptors
✅ Sentence structure and emphasis
✅ Which aspects of an achievement to highlight
✅ Order of information within a bullet

### 3. WHAT YOU CANNOT CHANGE
❌ Metrics and numbers — preserve exactly
❌ Client names and industries — preserve exactly
❌ Factual claims and scope — preserve exactly
❌ Specific entities — if source says "regional bank", output "regional bank", NOT "B2B banking partner"

### 4. BULLET QUALITY RULES
- **Maximum 40 words per bullet** (HARD LIMIT — count them)
- One sentence preferred, two short sentences maximum
- Structure: Action verb → What you did → Result with metric
- NO compound noun jargon (e.g., "B2B enterprise technology platform partner")
- Cut filler phrases ruthlessly

### 5. VERB RULES
- **Never repeat a verb within the same position**
- **Maximum 2 uses of any verb in entire resume**
- Vary: Led, Built, Drove, Developed, Created, Designed, Launched, Transformed, Architected, Pioneered, Established, Delivered, Scaled, Accelerated

### 6. PHRASE RULES
- **Never use the same phrase more than 2x in entire resume**
- After first use, find synonyms:
  - "strategic storytelling" → "narrative development" → "brand messaging"
  - "GTM alignment" → "go-to-market coordination" → "cross-functional alignment"
  - "executive narratives" → "leadership communications" → "C-suite messaging"

### 7. KEYWORD INTEGRATION
- Priority themes: MUST appear at least once, naturally integrated
- Secondary themes: Include only if they fit naturally
- ATS keywords: Weave into existing claims — don't stuff
- **If inserting a keyword makes the sentence awkward, DON'T insert it**

### 8. BRANDING RULES
${brandingMode === 'generic' ? `- Use generic versions of content (content_generic) when available` : 
`- Use branded content, but genericize for competitors: ${competitorCompanies.join(', ')}`}

---

## CONTENT VERSION SELECTION

Use these content versions based on format:
- **Summary**: Use content_long for long format, content_medium for short
- **Career Highlights**: Use content_medium for long format, content_short for short
- **Position Overviews**: Use content_long for long format, content_medium for short
- **Position Bullets**: Use content_medium (only in long format)

---

## OUTPUT FORMAT

Return valid JSON only. No markdown, no explanation, just JSON:

{
  "summary": "Complete summary text here...",
  "career_highlights": [
    "First highlight with bold hook phrase...",
    "Second highlight...",
    "Third highlight...",
    "Fourth highlight...",
    "Fifth highlight..."
  ],
  "positions": [
    {
      "number": 1,
      "title": "SVP Brand Strategy / Head of Brand Strategy Practice",
      "company": "Deloitte Digital",
      "dates": "May 2021 - Present",
      "location": "New York, NY",
      "overview": "Overview text here...",
      "bullets": [
        "First bullet (≤40 words)...",
        "Second bullet...",
        "Third bullet...",
        "Fourth bullet..."
      ]
    },
    {
      "number": 2,
      "title": "Sr. Director of Brand Strategy",
      "company": "Deloitte Digital", 
      "dates": "Apr 2018 - May 2021",
      "location": "New York, NY",
      "overview": "Overview text here...",
      "bullets": [
        "First bullet...",
        "Second bullet...",
        "Third bullet..."
      ]
    },
    {
      "number": 3,
      "title": "VP of Innovation",
      "company": "Omnicom Media Group",
      "dates": "May 2016 - Apr 2018",
      "location": "New York, NY",
      "overview": "Overview only, no bullets..."
    },
    {
      "number": 4,
      "title": "Head of Media Innovation",
      "company": "OMD Worldwide",
      "dates": "Apr 2015 - May 2016",
      "location": "New York, NY",
      "overview": "Overview only..."
    },
    {
      "number": 5,
      "title": "Senior Brand Strategist",
      "company": "Straightline International",
      "dates": "Jul 2014 - Apr 2015",
      "location": "New York, NY",
      "overview": "Overview only..."
    },
    {
      "number": 6,
      "title": "Brand Strategist",
      "company": "Agency Network",
      "dates": "Jun 2012 - Jul 2014",
      "location": "New York, NY",
      "overview": "Overview only..."
    }
  ],
  "themes_addressed": ["theme1", "theme2", "theme3"],
  "themes_not_addressed": ["theme4"],
  "verbs_used": ["Led", "Built", "Drove"],
  "content_ids_used": ["SUM-BR-01", "CH-01", "CH-02", "P1-OV", "P1-B01"]
}

---

## BEFORE YOU RESPOND

Self-check:
1. Is every bullet ≤40 words? Count them.
2. Did any verb repeat within a position? Fix it.
3. Did any phrase appear >2x? Use a synonym.
4. Are all priority themes addressed somewhere?
5. Did you preserve all metrics exactly?
6. Did you avoid jargon soup?

Now generate the resume.`;
}

function getCompetitors(targetCompany: string): string[] {
  const competitorMap: Record<string, string[]> = {
    'McKinsey': ['Deloitte', 'BCG', 'Bain', 'Accenture'],
    'BCG': ['Deloitte', 'McKinsey', 'Bain', 'Accenture'],
    'Bain': ['Deloitte', 'McKinsey', 'BCG', 'Accenture'],
    'Accenture': ['Deloitte', 'McKinsey', 'BCG', 'Bain'],
    'Deloitte': ['McKinsey', 'BCG', 'Bain', 'Accenture'],
    // Add more as needed
  };
  
  return competitorMap[targetCompany] || [];
}

export function parseGenerationResponse(response: string): GeneratedResume {
  // Strip any markdown code blocks if present
  let cleaned = response.trim();
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.slice(7);
  }
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.slice(3);
  }
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.slice(0, -3);
  }
  
  return JSON.parse(cleaned.trim());
}
```

---

## Task 2: Create Generation Function

**File**: `src/lib/claude.ts`

Add this function (keep existing functions for backward compatibility):

```typescript
import { buildMasterGenerationPrompt, parseGenerationResponse } from './prompts/master-generation';

export async function generateFullResume(input: {
  jdAnalysis: EnhancedJDAnalysis;
  format: 'long' | 'short';
  brandingMode: 'branded' | 'generic';
  targetCompany: string;
}): Promise<GeneratedResume> {
  // Fetch all content from database
  const summaries = await fetchAllSummaries();
  const careerHighlights = await fetchAllCareerHighlights();
  const positionContent = await fetchAllPositionContent();
  
  const prompt = buildMasterGenerationPrompt({
    ...input,
    summaries,
    careerHighlights,
    positionContent,
  });
  
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 8000,
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
  });
  
  const text = response.content[0].type === 'text' 
    ? response.content[0].text 
    : '';
  
  return parseGenerationResponse(text);
}

// Helper functions to fetch content
async function fetchAllSummaries(): Promise<ContentItem[]> {
  const result = await sql`
    SELECT * FROM content_items 
    WHERE type = 'summary'
    ORDER BY id
  `;
  return result.rows;
}

async function fetchAllCareerHighlights(): Promise<ContentItem[]> {
  const result = await sql`
    SELECT * FROM content_items 
    WHERE type = 'career_highlight'
    ORDER BY id
  `;
  return result.rows;
}

async function fetchAllPositionContent(): Promise<PositionContent[]> {
  // Fetch overviews
  const overviews = await sql`
    SELECT * FROM content_items 
    WHERE type = 'overview'
    ORDER BY position
  `;
  
  // Fetch bullets
  const bullets = await sql`
    SELECT * FROM content_items 
    WHERE type = 'bullet'
    ORDER BY position, id
  `;
  
  // Combine into position structure
  // You'll need to map the static position metadata here
  // (title, company, dates, location)
  
  return POSITIONS.map(pos => ({
    position: pos.number,
    title: pos.title,
    company: pos.company,
    dates: pos.dates,
    location: pos.location,
    overview: overviews.rows.find(o => o.position === pos.number),
    bullets: bullets.rows.filter(b => b.position === pos.number),
  }));
}
```

---

## Task 3: Add Position Metadata

**File**: `src/lib/rules.ts` (or create `src/lib/positions.ts`)

Add the static position data:

```typescript
export const POSITIONS = [
  {
    number: 1,
    title: 'SVP Brand Strategy / Head of Brand Strategy Practice',
    company: 'Deloitte Digital',
    dates: 'May 2021 - Present',
    location: 'New York, NY',
  },
  {
    number: 2,
    title: 'Sr. Director of Brand Strategy',
    company: 'Deloitte Digital',
    dates: 'Apr 2018 - May 2021',
    location: 'New York, NY',
  },
  {
    number: 3,
    title: 'VP of Innovation',
    company: 'Omnicom Media Group',
    dates: 'May 2016 - Apr 2018',
    location: 'New York, NY',
  },
  {
    number: 4,
    title: 'Head of Media Innovation',
    company: 'OMD Worldwide',
    dates: 'Apr 2015 - May 2016',
    location: 'New York, NY',
  },
  {
    number: 5,
    title: 'Senior Brand Strategist',
    company: 'Straightline International',
    dates: 'Jul 2014 - Apr 2015',
    location: 'New York, NY',
  },
  {
    number: 6,
    title: 'Brand Strategist',
    company: 'Agency Network',
    dates: 'Jun 2012 - Jul 2014',
    location: 'New York, NY',
  },
];
```

---

## Commit

```bash
git add .
git commit -m "feat: create master generation prompt for one-shot resume"
```

---

## Update HANDOFF.md

Add:
```markdown
## Session 2 Complete: Master Generation Prompt

**What was done**:
- Created buildMasterGenerationPrompt() with all quality rules inline
- Created generateFullResume() function
- Added position metadata constants
- Prompt includes: theme alignment, verb rules, phrase rules, jargon prevention

**Key files**:
- src/lib/prompts/master-generation.ts
- src/lib/claude.ts (new function added)
- src/lib/positions.ts (or rules.ts)

**Next**: Session 3 — One-Shot API Route
```

---

## Success Criteria

- [ ] Prompt compiles without errors
- [ ] Prompt includes all quality rules
- [ ] generateFullResume() function exists
- [ ] Position metadata is accessible
- [ ] Existing V1 functions still work

---

## Do NOT Do Yet

- Don't create the API route (Session 3)
- Don't add gap detection (Session 4)
- Don't modify UI (Session 6)
