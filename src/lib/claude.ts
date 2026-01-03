import Anthropic from '@anthropic-ai/sdk';
import type { JDAnalysis, JDKeyword, JDStrategic } from '../types';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Verb patterns for tracking action verb variety
const VERB_PATTERNS = [
  'Built', 'Developed', 'Created', 'Established', 'Launched', 'Designed',
  'Led', 'Directed', 'Oversaw', 'Managed', 'Headed', 'Guided',
  'Grew', 'Scaled', 'Expanded', 'Increased', 'Accelerated', 'Drove',
  'Transformed', 'Repositioned', 'Modernized', 'Revitalized', 'Redesigned',
  'Architected', 'Defined', 'Shaped', 'Crafted', 'Pioneered', 'Championed',
  'Delivered', 'Executed', 'Implemented', 'Activated', 'Orchestrated'
];

/**
 * Extract action verbs from resume content.
 * Detects verbs at the start of sentences or bullet points.
 */
export function extractVerbsFromContent(content: string): string[] {
  const found: string[] = [];
  for (const verb of VERB_PATTERNS) {
    // Match verb at start of sentence, after bullet, or after newline
    const regex = new RegExp(`(?:^|[•\\-\\n]|\\. )\\s*${verb}\\b`, 'gi');
    if (regex.test(content)) {
      found.push(verb);
    }
  }
  return Array.from(new Set(found)); // Dedupe
}

// Legacy JDAnalysis interface for backward compatibility during migration
export interface LegacyJDAnalysis {
  targetTitle: string;
  targetCompany: string;
  industry: string;
  keywords: string[];
  themes: string[];
  recommendedBrandingMode: 'branded' | 'generic';
  reasoning: string;
}

// Raw response from Claude before processing
interface RawJDAnalysisResponse {
  strategic: JDStrategic;
  keywords: Array<{
    keyword: string;
    category: 'hard_skill' | 'soft_skill' | 'industry_term' | 'seniority_signal';
    priority: 'high' | 'medium' | 'low';
    placement: string;
  }>;
  recommendedBrandingMode: 'branded' | 'generic';
  reasoning: string;
}

export type { JDAnalysis, JDKeyword };

export async function analyzeJobDescription(jobDescription: string): Promise<{
  analysis: JDAnalysis;
  recommendedBrandingMode: 'branded' | 'generic';
  reasoning: string;
}> {
  const response = await anthropic.messages.create({
    model: 'claude-opus-4-5-20251101',
    max_tokens: 2048,
    messages: [
      {
        role: 'user',
        content: `Analyze this job description and extract TWO types of information:

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

Return ONLY the JSON object, no other text.`,
      },
    ],
  });

  const content = response.content[0];
  if (content.type !== 'text') {
    throw new Error('Unexpected response type');
  }

  try {
    const parsed = JSON.parse(content.text) as RawJDAnalysisResponse;
    return {
      analysis: {
        strategic: parsed.strategic,
        keywords: parsed.keywords.map((k, i) => ({
          ...k,
          id: `kw_${String(i + 1).padStart(3, '0')}`,
          status: 'unaddressed' as const,
        })),
      },
      recommendedBrandingMode: parsed.recommendedBrandingMode,
      reasoning: parsed.reasoning,
    };
  } catch {
    // Try to extract JSON from the response
    const jsonMatch = content.text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]) as RawJDAnalysisResponse;
      return {
        analysis: {
          strategic: parsed.strategic,
          keywords: parsed.keywords.map((k, i) => ({
            ...k,
            id: `kw_${String(i + 1).padStart(3, '0')}`,
            status: 'unaddressed' as const,
          })),
        },
        recommendedBrandingMode: parsed.recommendedBrandingMode,
        reasoning: parsed.reasoning,
      };
    }
    throw new Error('Failed to parse JD analysis response');
  }
}

export async function generateTailoredContent(
  originalContent: string,
  jdAnalysis: JDAnalysis,
  sectionType: string,
  instructions?: string,
  unaddressedKeywords?: JDKeyword[],
  usedVerbs: string[] = []
): Promise<string> {
  // Build keyword list for the prompt (top 5 unaddressed)
  const keywordsToIncorporate = unaddressedKeywords
    ? unaddressedKeywords.slice(0, 5).map((k) => `- ${k.keyword} (${k.priority})`).join('\n')
    : 'None specified';

  const response = await anthropic.messages.create({
    model: 'claude-opus-4-5-20251101',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: `You are an executive resume writer creating content for a senior brand strategist.

TARGET ROLE: ${jdAnalysis.strategic.targetTitle} at ${jdAnalysis.strategic.targetCompany}
INDUSTRY: ${jdAnalysis.strategic.industry}

POSITIONING THEMES (the story to tell):
${jdAnalysis.strategic.positioningThemes.map((t) => `- ${t}`).join('\n')}

KEYWORDS TO INCORPORATE (where natural):
${keywordsToIncorporate}

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

Return ONLY the tailored content with <mark> tags.`,
      },
    ],
  });

  const responseContent = response.content[0];
  if (responseContent.type !== 'text') {
    throw new Error('Unexpected response type');
  }

  return responseContent.text.trim();
}

export async function generateSummary(
  summaryOptions: string[],
  jdAnalysis: JDAnalysis,
  format: 'long' | 'short',
  unaddressedKeywords?: JDKeyword[],
  usedVerbs: string[] = []
): Promise<string> {
  // Build keyword list for ATS optimization
  const keywordsList = unaddressedKeywords
    ? unaddressedKeywords.map((k) => `- ${k.keyword}`).join('\n')
    : 'None specified';

  const response = await anthropic.messages.create({
    model: 'claude-opus-4-5-20251101',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: `Create an executive summary for a senior brand strategist resume.

TARGET: ${jdAnalysis.strategic.targetTitle} at ${jdAnalysis.strategic.targetCompany}
INDUSTRY: ${jdAnalysis.strategic.industry}
FORMAT: ${format} (${format === 'long' ? '4-5 sentences' : '3-4 sentences'})

POSITIONING THEMES:
${jdAnalysis.strategic.positioningThemes.map((t) => `- ${t}`).join('\n')}

ATS KEYWORDS (this is your power zone - aim for 8-12 naturally integrated):
${keywordsList}

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

Return ONLY the summary text.`,
      },
    ],
  });

  const responseContent = response.content[0];
  if (responseContent.type !== 'text') {
    throw new Error('Unexpected response type');
  }

  return responseContent.text.trim();
}

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

export async function refinePositionContent(
  overview: string,
  bullets: string[],
  instructions: string,
  jdAnalysis: JDAnalysis,
  conversationHistory?: ConversationMessage[],
  unaddressedKeywords?: JDKeyword[],
  usedVerbs: string[] = []
): Promise<{ overview: string; bullets: string[] }> {
  // Extract verbs already used in this position's current content
  const positionContent = overview + ' ' + bullets.join(' ');
  const positionVerbs = extractVerbsFromContent(positionContent);

  // Build keyword list for prompt
  const keywordsList = unaddressedKeywords
    ? unaddressedKeywords.slice(0, 5).map((k) => `- ${k.keyword}`).join('\n')
    : 'None specified';

  // Build the system context
  const systemContext = `You are helping refine position content on a resume based on user feedback.

TARGET ROLE: ${jdAnalysis.strategic.targetTitle} at ${jdAnalysis.strategic.targetCompany}
INDUSTRY: ${jdAnalysis.strategic.industry}
KEY THEMES: ${jdAnalysis.strategic.positioningThemes.join(', ')}

KEYWORDS TO INCORPORATE (where natural):
${keywordsList}

Current Overview:
${overview}

Current Bullets:
${bullets.map((b, i) => `${i + 1}. ${b}`).join('\n')}

QUALITY STANDARDS:
- Every bullet must have a quantified result
- No verb can repeat within this position
- Keyword density: 1-2 per bullet maximum
- If user asks for something not in original content, explain you cannot invent facts

CRITICAL INTEGRITY RULES (violations are unacceptable):
1. NEVER change any metrics, numbers, or percentages
2. NEVER add industries, sectors, or client types not already in the content
3. NEVER fabricate capabilities, experiences, or outcomes
4. NEVER inflate scope, scale, or impact beyond what's stated

Apply the user's requested changes while maintaining all factual accuracy.

VERB CONSTRAINTS:
Already used in resume: ${usedVerbs.join(', ') || 'None'}
Already used in THIS position: ${positionVerbs.join(', ') || 'None'}
Choose from: Built, Developed, Created, Launched, Led, Directed, Grew, Scaled, Transformed, Architected, Delivered, Executed, Pioneered

BULLET STRUCTURE (CAR Method):
Each bullet must follow: [Action Verb] + [What/Challenge] + [How/Method] + [Result/Metrics]

CUSTOMIZATION MARKING:
- Wrap ONLY actual changes in <mark> tags
- Preserve existing <mark> tags if that text remains customized
- Aim for 2-4 marks per bullet maximum

Return a JSON object with:
{
  "overview": "the updated overview text with <mark> tags",
  "bullets": ["bullet 1 with <mark>tags</mark>", "bullet 2", ...]
}

If the user's request only affects bullets, keep the overview the same.
If the user's request only affects the overview, keep the bullets the same.

Return ONLY the JSON object, no other text.`;

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

  const response = await anthropic.messages.create({
    model: 'claude-opus-4-5-20251101',
    max_tokens: 2048,
    messages,
  });

  const responseContent = response.content[0];
  if (responseContent.type !== 'text') {
    throw new Error('Unexpected response type');
  }

  try {
    return JSON.parse(responseContent.text) as { overview: string; bullets: string[] };
  } catch {
    // Try to extract JSON from the response
    const jsonMatch = responseContent.text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]) as { overview: string; bullets: string[] };
    }
    // Return original content if parsing fails
    return { overview, bullets };
  }
}

// Detect which keywords were addressed in generated content using Claude analysis
export async function detectAddressedKeywords(
  content: string,
  keywords: JDKeyword[]
): Promise<string[]> {
  if (keywords.length === 0) {
    return [];
  }

  const response = await anthropic.messages.create({
    model: 'claude-opus-4-5-20251101',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: `Analyze the following resume content and determine which of the provided keywords have been incorporated (either exactly or semantically).

RESUME CONTENT:
${content}

KEYWORDS TO CHECK:
${keywords.map((k) => `- ${k.id}: "${k.keyword}"`).join('\n')}

For each keyword, determine if it has been addressed in the content. A keyword is "addressed" if:
1. The exact phrase appears in the content, OR
2. A clear semantic equivalent appears (e.g., "P&L management" addressed by "managed a $40M P&L")

Return a JSON array of the keyword IDs that have been addressed:
["kw_001", "kw_003", ...]

If no keywords were addressed, return an empty array: []

Return ONLY the JSON array, no other text.`,
      },
    ],
  });

  const responseContent = response.content[0];
  if (responseContent.type !== 'text') {
    return [];
  }

  try {
    return JSON.parse(responseContent.text) as string[];
  } catch {
    const jsonMatch = responseContent.text.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]) as string[];
    }
    return [];
  }
}

// Regenerate content with a specific keyword incorporated through translation
export async function regenerateWithKeyword(
  currentContent: string,
  keyword: JDKeyword,
  userContext: string,
  jdAnalysis: JDAnalysis,
  sectionType: string
): Promise<string> {
  const response = await anthropic.messages.create({
    model: 'claude-opus-4-5-20251101',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: `Incorporate a specific keyword into resume content through TRANSLATION, not insertion.

KEYWORD TO ADD: "${keyword.keyword}"
USER CONTEXT: "${userContext}"
SECTION: ${sectionType}

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

Return ONLY the updated content.`,
      },
    ],
  });

  const responseContent = response.content[0];
  if (responseContent.type !== 'text') {
    throw new Error('Unexpected response type');
  }

  return responseContent.text.trim();
}

export default anthropic;
