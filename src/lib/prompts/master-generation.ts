import type { EnhancedJDAnalysis, GeneratedResume } from '@/types';
import type { ContentItem } from '@/drizzle/schema';
import { POSITIONS, CONFLICT_MAP } from '@/lib/rules';

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
  industry_tags?: string[];
  exclusive_metrics?: string[];
}

// Variant shape for three-level matching
export interface PromptVariant {
  id: string;
  base_id: string;
  variant_label: string;
  context: string;
  method: string;
  outcome: string;
  content: string;
  theme_tags: string[];
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
  careerHighlightVariants: PromptVariant[];
  positionContent: PositionContent[];
  positionVariants: PromptVariant[];
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
    industry_tags: item.industryTags || [],
    exclusive_metrics: item.exclusiveMetrics || [],
  };
}

/**
 * Maps database ContentItem (variant) to PromptVariant format
 */
export function mapContentItemToVariant(item: ContentItem): PromptVariant {
  return {
    id: item.id,
    base_id: item.baseId || '',
    variant_label: item.variantLabel || '',
    context: item.context || '',
    method: item.method || '',
    outcome: '', // Extracted from content if needed
    content: item.contentLong || '',
    theme_tags: item.themeTags || [],
  };
}

/**
 * Format conflict rules for the prompt
 * These are CH ↔ P-B pairs that share the same achievement/metric
 */
function formatConflictRules(): string {
  const rules: string[] = [];
  for (const [chId, bullets] of Object.entries(CONFLICT_MAP)) {
    for (const bulletId of bullets) {
      rules.push(`- ${chId} ↔ ${bulletId} (same achievement - CANNOT use both)`);
    }
  }
  return rules.join('\n');
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
 * Group variants by their base_id
 */
function groupVariantsByBase(variants: PromptVariant[]): Record<string, PromptVariant[]> {
  const grouped: Record<string, PromptVariant[]> = {};
  for (const v of variants) {
    if (!grouped[v.base_id]) {
      grouped[v.base_id] = [];
    }
    grouped[v.base_id].push(v);
  }
  return grouped;
}

/**
 * Format career highlights with their variants for three-level matching
 */
function formatCareerHighlightsWithVariants(
  baseItems: PromptContentItem[],
  variants: PromptVariant[]
): string {
  const variantsByBase = groupVariantsByBase(variants);

  return baseItems.map(item => {
    const itemVariants = variantsByBase[item.id] || [];
    return `
#### ${item.id}
**Industry Tags**: ${item.industry_tags?.join(', ') || 'General'}
**Function Tags**: ${item.function_tags?.join(', ') || 'General'}
**Metrics**: ${item.exclusive_metrics?.join(', ') || 'N/A'}

**Available Variants**:
${itemVariants.length > 0 ? itemVariants.map(v => `
- **${v.id} (${v.variant_label})**
  Theme Tags: ${v.theme_tags.join(', ')}
  Content: ${v.content}
`).join('\n') : 'No variants - use base content'}

**Base Content** (if no variant fits):
${item.content_long || item.content_medium || item.content_short}
`;
  }).join('\n---\n');
}

/**
 * Format position bullets with their variants for three-level matching
 */
function formatPositionBulletsWithVariants(
  position: PositionContent,
  variants: PromptVariant[]
): string {
  const variantsByBase = groupVariantsByBase(variants);

  return position.bullets.map(bullet => {
    const bulletVariants = variantsByBase[bullet.id] || [];
    return `
#### ${bullet.id}
**Industry Tags**: ${bullet.industry_tags?.join(', ') || 'General'}
**Function Tags**: ${bullet.function_tags?.join(', ') || 'General'}

${bulletVariants.length > 0 ? `**Variants**:
${bulletVariants.map(v => `- **${v.variant_label}**: ${v.content} [Tags: ${v.theme_tags.join(', ')}]`).join('\n')}` : ''}

**Base Content**: ${bullet.content_long || bullet.content_medium || bullet.content_short}
`;
  }).join('\n');
}

/**
 * Build the master generation prompt for one-shot resume generation
 */
export function buildMasterGenerationPrompt(input: MasterPromptInput): string {
  const {
    jdAnalysis,
    summaries,
    careerHighlights,
    careerHighlightVariants,
    positionContent,
    positionVariants,
    format,
    brandingMode,
    targetCompany,
  } = input;

  const competitorCompanies = getCompetitors(targetCompany);
  const p1BulletCount = format === 'long' ? 4 : 0;
  const p2BulletCount = format === 'long' ? 3 : 0;

  // Filter P1 and P2 variants
  const p1Variants = positionVariants.filter(v => v.id.startsWith('P1-'));
  const p2Variants = positionVariants.filter(v => v.id.startsWith('P2-'));

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

## CONTENT SELECTION: THREE-LEVEL MATCHING

You must select content using this priority system:

### LEVEL 1: INDUSTRY RELEVANCE
First, identify which base achievements are relevant to the target industry.

**Target Industry**: Infer from ${jdAnalysis.target_company} and role context
**Target Company**: ${jdAnalysis.target_company}

For each base item, check if its industry_tags include or relate to the target industry.
Prioritize items that directly match the industry.

### LEVEL 2: FUNCTION RELEVANCE
Next, prioritize items whose function_tags match the role type.

**Target Role**: ${jdAnalysis.target_title}
**Role Functions**: Infer from priority themes: ${jdAnalysis.priority_themes.map(t => t.theme).slice(0, 3).join(', ')}

Prioritize items with matching function_tags (e.g., brand-strategy, product-marketing, demand-generation).

### LEVEL 3: VARIANT SELECTION
For each base item you select, choose the variant that best matches priority themes.

**Priority Themes**:
${jdAnalysis.priority_themes.map(t => `- ${t.theme}`).join('\n')}

Match variant theme_tags to priority themes. Select the variant whose emphasis best aligns with what the JD values.

---

## CONTENT DATABASE

You must SELECT from and RESHAPE the content below.
**CRITICAL**: Never invent metrics, clients, or claims. Only reshape existing content.

### AVAILABLE SUMMARIES
${summaries.map(s => formatContentForPrompt(s)).join('\n\n')}

### AVAILABLE CAREER HIGHLIGHTS WITH VARIANTS (Select 5)

${formatCareerHighlightsWithVariants(careerHighlights, careerHighlightVariants)}

### POSITION CONTENT WITH VARIANTS

${positionContent.map((p, i) => `
#### POSITION ${p.position}: ${p.title} at ${p.company}
**Dates**: ${p.dates}
**Location**: ${p.location}

**Overview Options**:
${p.overview ? formatContentForPrompt(p.overview) : 'No overview available'}

**Bullet Options${i === 0 ? ` (Select ${p1BulletCount})` : i === 1 ? ` (Select ${p2BulletCount})` : ''}**:
${i === 0 && p.bullets.length > 0 ? formatPositionBulletsWithVariants(p, p1Variants) :
  i === 1 && p.bullets.length > 0 ? formatPositionBulletsWithVariants(p, p2Variants) :
  p.bullets.length > 0 ? p.bullets.map(b => formatContentForPrompt(b)).join('\n\n') : 'No bullets available'}
`).join('\n')}

---

## CONFLICT RULES (CRITICAL - MUST ENFORCE)

Some Career Highlights and Position Bullets describe the SAME achievement with the same metrics.
**You CANNOT use both items from a conflict pair.** If you select a Career Highlight, its conflicting Position Bullet is BLOCKED (and vice versa).

### CONFLICT PAIRS:
${formatConflictRules()}

**Enforcement**:
1. When selecting Career Highlights, note which P-B IDs become blocked
2. When selecting Position Bullets, check that none are blocked by your Career Highlight selections
3. If you need to use a blocked bullet's achievement, use the Career Highlight version instead (or vice versa)

Example: If you select CH-01 for Career Highlights, you CANNOT use P1-B02 for Position 1 bullets - they both describe the $40M brand strategy practice achievement.

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

**IMPORTANT**: For career highlights and position bullets, include the variant ID you selected (or base ID if no variant was used).

{
  "summary": "Complete summary text here...",
  "career_highlights": [
    {
      "id": "CH-01-V2",
      "base_id": "CH-01",
      "variant_label": "Team Leadership",
      "content": "**Bold hook phrase**: First highlight with narrative..."
    },
    {
      "id": "CH-02-V1",
      "base_id": "CH-02",
      "variant_label": "Brand Strategy",
      "content": "**Second highlight hook**: Content..."
    }
  ],
  "positions": [
    {
      "number": 1,
      "title": "${POSITIONS[0].titleDefault}",
      "company": "${POSITIONS[0].company}",
      "dates": "${POSITIONS[0].dates}",
      "location": "${POSITIONS[0].location}",
      "overview": "Overview text here...",
      "bullets": ${p1BulletCount > 0 ? `[
        {"id": "P1-B01-V1", "base_id": "P1-B01", "variant_label": "Brand Repositioning", "content": "First bullet (≤40 words)..."},
        {"id": "P1-B06-V2", "base_id": "P1-B06", "variant_label": "Corporate Communications", "content": "Second bullet..."},
        {"id": "P1-B10-V1", "base_id": "P1-B10", "variant_label": "Brand Launch", "content": "Third bullet..."},
        {"id": "P1-B02", "base_id": "P1-B02", "variant_label": null, "content": "Fourth bullet (no variant used)..."}
      ]` : '[]'}
    },
    {
      "number": 2,
      "title": "${POSITIONS[1].titleDefault}",
      "company": "${POSITIONS[1].company}",
      "dates": "${POSITIONS[1].dates}",
      "location": "${POSITIONS[1].location}",
      "overview": "Overview text here...",
      "bullets": ${p2BulletCount > 0 ? `[
        {"id": "P2-B01-V1", "base_id": "P2-B01", "variant_label": "Brand Strategy", "content": "First bullet..."},
        {"id": "P2-B02-V2", "base_id": "P2-B02", "variant_label": "Creative Campaign", "content": "Second bullet..."},
        {"id": "P2-B03", "base_id": "P2-B03", "variant_label": null, "content": "Third bullet (no variant used)..."}
      ]` : '[]'}
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
11. **CONFLICT CHECK**: Did you use any Career Highlight AND its conflicting Position Bullet? If yes, REMOVE ONE.

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

  // Transform career_highlights from objects to strings if needed
  // Claude returns: { id, base_id, variant_label, content }
  // We need: string[]
  if (Array.isArray(parsed.career_highlights)) {
    parsed.career_highlights = parsed.career_highlights.map((ch: unknown) => {
      if (typeof ch === 'string') return ch;
      if (ch && typeof ch === 'object' && 'content' in ch) {
        return (ch as { content: string }).content;
      }
      return String(ch);
    });
  }

  // Transform position bullets from objects to strings if needed
  if (Array.isArray(parsed.positions)) {
    parsed.positions = parsed.positions.map((pos: { bullets?: unknown[] }) => {
      if (pos.bullets && Array.isArray(pos.bullets)) {
        pos.bullets = pos.bullets.map((b: unknown) => {
          if (typeof b === 'string') return b;
          if (b && typeof b === 'object' && 'content' in b) {
            return (b as { content: string }).content;
          }
          return String(b);
        });
      }
      return pos;
    });
  }

  return parsed as GeneratedResume;
}
