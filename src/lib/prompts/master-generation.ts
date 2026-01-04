import type { EnhancedJDAnalysis, GeneratedResume } from '@/types';
import type { ContentItem } from '@/drizzle/schema';
import { POSITIONS } from '@/lib/rules';

// Content item shape for prompt building
export interface PromptContentItem {
  id: string;
  content_short: string | null;
  content_medium: string | null;
  content_long: string | null;
  content_generic: string | null;
  brand_tags: string[];
  category_tags: string[];
  function_tags: string[];
  outcome_tags: string[];
}

export interface PositionContent {
  position: number;
  title: string;
  company: string;
  dates: string;
  location: string;
  overview: PromptContentItem | null;
  bullets: PromptContentItem[];
}

export interface MasterPromptInput {
  jdAnalysis: EnhancedJDAnalysis;
  summaries: PromptContentItem[];
  careerHighlights: PromptContentItem[];
  positionContent: PositionContent[];
  format: 'long' | 'short';
  brandingMode: 'branded' | 'generic';
  targetCompany: string;
}

/**
 * Maps database ContentItem to prompt format
 */
export function mapContentItemToPrompt(item: ContentItem): PromptContentItem {
  return {
    id: item.id,
    content_short: item.contentShort,
    content_medium: item.contentMedium,
    content_long: item.contentLong,
    content_generic: item.contentGeneric,
    brand_tags: item.brandTags || [],
    category_tags: item.categoryTags || [],
    function_tags: item.functionTags || [],
    outcome_tags: item.outcomeTags || [],
  };
}

/**
 * Get competitors for a target company (for branding rules)
 */
function getCompetitors(targetCompany: string): string[] {
  const competitorMap: Record<string, string[]> = {
    'McKinsey': ['Deloitte', 'BCG', 'Bain', 'Accenture'],
    'BCG': ['Deloitte', 'McKinsey', 'Bain', 'Accenture'],
    'Bain': ['Deloitte', 'McKinsey', 'BCG', 'Accenture'],
    'Accenture': ['Deloitte', 'McKinsey', 'BCG', 'Bain'],
    'Deloitte': ['McKinsey', 'BCG', 'Bain', 'Accenture'],
    'EY': ['Deloitte', 'McKinsey', 'BCG', 'Bain', 'Accenture', 'KPMG', 'PwC'],
    'KPMG': ['Deloitte', 'McKinsey', 'BCG', 'Bain', 'Accenture', 'EY', 'PwC'],
    'PwC': ['Deloitte', 'McKinsey', 'BCG', 'Bain', 'Accenture', 'EY', 'KPMG'],
    'WPP': ['Omnicom', 'OMD', 'Publicis', 'IPG', 'Dentsu'],
    'Publicis': ['Omnicom', 'OMD', 'WPP', 'IPG', 'Dentsu'],
    'IPG': ['Omnicom', 'OMD', 'WPP', 'Publicis', 'Dentsu'],
    'Dentsu': ['Omnicom', 'OMD', 'WPP', 'Publicis', 'IPG'],
  };

  return competitorMap[targetCompany] || [];
}

/**
 * Format content item for prompt display
 */
function formatContentForPrompt(item: PromptContentItem): string {
  return JSON.stringify({
    id: item.id,
    short: item.content_short,
    medium: item.content_medium,
    long: item.content_long,
    generic: item.content_generic,
    tags: {
      brand: item.brand_tags,
      category: item.category_tags,
      function: item.function_tags,
      outcome: item.outcome_tags,
    }
  }, null, 2);
}

/**
 * Build the master generation prompt for one-shot resume generation
 */
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

  const competitorCompanies = getCompetitors(targetCompany);
  const p1BulletCount = format === 'long' ? 4 : 0;
  const p2BulletCount = format === 'long' ? 3 : 0;

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
1. **Summary**: Exactly 4 sentences (50-75 words) — see SUMMARY REQUIREMENTS below
2. **Career Highlights**: Exactly 5 highlights (40-55 words each) — see CAREER HIGHLIGHTS REQUIREMENTS below
3. **Position 1**: Overview + ${p1BulletCount} bullets
4. **Position 2**: Overview + ${p2BulletCount} bullets
5. **Positions 3-6**: Overview only (no bullets)

---

## CONTENT DATABASE

You must SELECT from and RESHAPE the content below.
**CRITICAL**: Never invent metrics, clients, or claims. Only reshape existing content.

### AVAILABLE SUMMARIES
${summaries.map(s => formatContentForPrompt(s)).join('\n\n')}

### AVAILABLE CAREER HIGHLIGHTS
${careerHighlights.map(ch => formatContentForPrompt(ch)).join('\n\n')}

### POSITION CONTENT
${positionContent.map(p => `
#### POSITION ${p.position}: ${p.title} at ${p.company}
**Dates**: ${p.dates}
**Location**: ${p.location}

**Overview Options**:
${p.overview ? formatContentForPrompt(p.overview) : 'No overview available'}

**Bullet Options**:
${p.bullets.length > 0 ? p.bullets.map(b => formatContentForPrompt(b)).join('\n\n') : 'No bullets available'}
`).join('\n')}

---

## RESHAPING RULES

### 1. NARRATIVE ALIGNMENT
- Reframe content to address JD priority themes
- Lead with what matters most to THIS role
- Translate YOUR language to THEIR terminology
- Example: If JD says "enterprise buyer journeys", reframe CRM work as "buyer journey acceleration"

### 2. WHAT YOU CAN CHANGE
- Action verbs (vary them — never repeat within a section)
- Adjectives and descriptors
- Sentence structure and emphasis
- Which aspects of an achievement to highlight
- Order of information within a bullet

### 3. WHAT YOU CANNOT CHANGE
- Metrics and numbers — preserve exactly
- Client names and industries — preserve exactly
- Factual claims and scope — preserve exactly
- Specific entities — if source says "regional bank", output "regional bank", NOT "B2B banking partner"

### 4. BULLET QUALITY RULES
- **Maximum 40 words per bullet** (HARD LIMIT — count them)
- One sentence preferred, two short sentences maximum
- Structure: Action verb -> What you did -> Result with metric
- NO compound noun jargon (e.g., "B2B enterprise technology platform partner")
- Cut filler phrases ruthlessly

### 5. VERB RULES
- **Never repeat a verb within the same position**
- **Maximum 2 uses of any verb in entire resume**
- Vary: Led, Built, Drove, Developed, Created, Designed, Launched, Transformed, Architected, Pioneered, Established, Delivered, Scaled, Accelerated

### 6. PHRASE RULES
- **Never use the same phrase more than 2x in entire resume**
- After first use, find synonyms:
  - "strategic storytelling" -> "narrative development" -> "brand messaging"
  - "GTM alignment" -> "go-to-market coordination" -> "cross-functional alignment"
  - "executive narratives" -> "leadership communications" -> "C-suite messaging"

### 7. KEYWORD INTEGRATION
- Priority themes: MUST appear at least once, naturally integrated
- Secondary themes: Include only if they fit naturally
- ATS keywords: Weave into existing claims — don't stuff
- **If inserting a keyword makes the sentence awkward, DON'T insert it**

### 8. BRANDING RULES
${brandingMode === 'generic' ? `- Use generic versions of content (content_generic) when available` :
`- Use branded content, but genericize for competitors: ${competitorCompanies.join(', ')}`}

---

## SUMMARY REQUIREMENTS

The summary must be exactly 4 sentences following this narrative arc:

1. **Identity statement**: Who you are, years of experience, core positioning (e.g., "Portfolio transformation leader who unifies fragmented marketing strategies into scalable growth engines")

2. **Macro signature achievement**: A PATTERN of impact, not a single metric. Describe the type of transformation you repeatedly deliver.
   - CORRECT: "Track record of transforming fragmented marketing organizations into unified growth engines across Fortune 500 enterprises"
   - WRONG: "Built a $40M brand strategy practice at Deloitte Digital" (too specific/single achievement)

3. **How you work**: Your approach, methodology, or cross-functional leadership style (e.g., "Cross-functional executive who orchestrates complex stakeholder ecosystems")

4. **Outcome/value**: What results you deliver to organizations, framed in JD language

Requirements:
- Total length: 50-75 words
- Integrate 2-3 priority keywords from JD naturally (not forced)
- Must read as a cohesive narrative paragraph, not a list of attributes
- Use source summaries as raw material, reshape to match JD themes

---

## CAREER HIGHLIGHTS REQUIREMENTS

Each career highlight must follow this exact format:

**[Bold hook phrase tailored to JD]**: [Narrative sentence connecting the achievement to context and measurable result]

Example for a Portfolio Marketing JD:
**Transformed premium card portfolio into growth engine for Fortune 100 financial services leader**: Unified fragmented regional marketing efforts into scalable demand generation system, delivering 50% YoY engagement growth and $60M in new revenue through integrated GTM activation.

Requirements:
- Total length per highlight: 40-55 words (longer than position bullets — these are mini-stories)
- The bold hook (before the colon) should:
  - Echo JD language naturally/interpretively (not keyword-stuffed)
  - Be 8-12 words
  - Frame the achievement in terms the target role cares about
- The narrative portion (after the colon) should:
  - Provide context on what you did
  - Connect to a JD theme where possible
  - End with measurable result(s)
- Use source content from database as raw material, then REWRITE into narrative form
- The connection to JD themes is what makes highlights compelling — reshape existing achievements to resonate with target role
- Each highlight MUST include at least one quantified metric

---

## CONTENT VERSION SELECTION

Use these content versions based on format:
- **Summary**: Use content_long for long format, content_medium for short
- **Career Highlights**: Use content_long as raw material (need more substance to hit 40-55 words)
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
      "title": "${POSITIONS[0].titleDefault}",
      "company": "${POSITIONS[0].company}",
      "dates": "${POSITIONS[0].dates}",
      "location": "${POSITIONS[0].location}",
      "overview": "Overview text here...",
      "bullets": ${p1BulletCount > 0 ? '["First bullet (≤40 words)...", "Second bullet...", "Third bullet...", "Fourth bullet..."]' : '[]'}
    },
    {
      "number": 2,
      "title": "${POSITIONS[1].titleDefault}",
      "company": "${POSITIONS[1].company}",
      "dates": "${POSITIONS[1].dates}",
      "location": "${POSITIONS[1].location}",
      "overview": "Overview text here...",
      "bullets": ${p2BulletCount > 0 ? '["First bullet...", "Second bullet...", "Third bullet..."]' : '[]'}
    },
    {
      "number": 3,
      "title": "${POSITIONS[2].titleDefault}",
      "company": "${POSITIONS[2].company}",
      "dates": "${POSITIONS[2].dates}",
      "location": "${POSITIONS[2].location}",
      "overview": "Overview only, no bullets..."
    },
    {
      "number": 4,
      "title": "${POSITIONS[3].titleDefault}",
      "company": "${POSITIONS[3].company}",
      "dates": "${POSITIONS[3].dates}",
      "location": "${POSITIONS[3].location}",
      "overview": "Overview only..."
    },
    {
      "number": 5,
      "title": "${POSITIONS[4].titleDefault}",
      "company": "${POSITIONS[4].company}",
      "dates": "${POSITIONS[4].dates}",
      "location": "${POSITIONS[4].location}",
      "overview": "Overview only..."
    },
    {
      "number": 6,
      "title": "${POSITIONS[5].titleDefault}",
      "company": "${POSITIONS[5].company}",
      "dates": "${POSITIONS[5].dates}",
      "location": "${POSITIONS[5].location}",
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
1. Is the summary exactly 4 sentences and 50-75 words? Count them.
2. Does the summary follow the narrative arc (identity → pattern of impact → how you work → value)?
3. Is every career highlight 40-55 words with a bold hook phrase before the colon?
4. Does each career highlight include at least one quantified metric?
5. Is every position bullet ≤40 words? Count them.
6. Did any verb repeat within a position? Fix it.
7. Did any phrase appear >2x? Use a synonym.
8. Are all priority themes addressed somewhere?
9. Did you preserve all metrics exactly?
10. Did you avoid jargon soup?

Now generate the resume.`;
}

/**
 * Parse the generation response from Claude into a GeneratedResume object
 */
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

  const parsed = JSON.parse(cleaned.trim());

  // Add generated_at timestamp if not present
  if (!parsed.generated_at) {
    parsed.generated_at = new Date().toISOString();
  }

  return parsed as GeneratedResume;
}
