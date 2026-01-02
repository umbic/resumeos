import Anthropic from '@anthropic-ai/sdk';
import type { JDAnalysis, JDKeyword, JDStrategic } from '../types';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

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
  unaddressedKeywords?: JDKeyword[]
): Promise<string> {
  // Build keyword sections for the prompt
  const keywordsByCategory = unaddressedKeywords
    ? {
        hard_skills: unaddressedKeywords.filter((k) => k.category === 'hard_skill').map((k) => k.keyword),
        soft_skills: unaddressedKeywords.filter((k) => k.category === 'soft_skill').map((k) => k.keyword),
        industry_terms: unaddressedKeywords.filter((k) => k.category === 'industry_term').map((k) => k.keyword),
      }
    : null;

  const keywordSection = keywordsByCategory
    ? `
**ATS Keywords to Mirror** (where natural and authentic):
${keywordsByCategory.hard_skills.length > 0 ? `- Hard Skills: ${keywordsByCategory.hard_skills.join(', ')}` : ''}
${keywordsByCategory.soft_skills.length > 0 ? `- Soft Skills: ${keywordsByCategory.soft_skills.join(', ')}` : ''}
${keywordsByCategory.industry_terms.length > 0 ? `- Industry Terms: ${keywordsByCategory.industry_terms.join(', ')}` : ''}
`
    : '';

  const response = await anthropic.messages.create({
    model: 'claude-opus-4-5-20251101',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: `Tailor this resume content for a specific job application. You must preserve all facts from the original.

Target Role: ${jdAnalysis.strategic.targetTitle} at ${jdAnalysis.strategic.targetCompany}
Industry: ${jdAnalysis.strategic.industry}

**Positioning Themes** (story to tell):
${jdAnalysis.strategic.positioningThemes.map((t) => `- ${t}`).join('\n')}
${keywordSection}
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

Return ONLY the tailored content with <mark> tags inline.`,
      },
    ],
  });

  const content = response.content[0];
  if (content.type !== 'text') {
    throw new Error('Unexpected response type');
  }

  return content.text.trim();
}

export async function generateSummary(
  summaryOptions: string[],
  jdAnalysis: JDAnalysis,
  format: 'long' | 'short',
  unaddressedKeywords?: JDKeyword[]
): Promise<string> {
  // Build keyword sections for the prompt
  const keywordsByCategory = unaddressedKeywords
    ? {
        hard_skills: unaddressedKeywords.filter((k) => k.category === 'hard_skill').map((k) => k.keyword),
        soft_skills: unaddressedKeywords.filter((k) => k.category === 'soft_skill').map((k) => k.keyword),
        industry_terms: unaddressedKeywords.filter((k) => k.category === 'industry_term').map((k) => k.keyword),
      }
    : null;

  const keywordSection = keywordsByCategory
    ? `
**ATS Keywords to Mirror** (where natural and authentic):
${keywordsByCategory.hard_skills.length > 0 ? `- Hard Skills: ${keywordsByCategory.hard_skills.join(', ')}` : ''}
${keywordsByCategory.soft_skills.length > 0 ? `- Soft Skills: ${keywordsByCategory.soft_skills.join(', ')}` : ''}
${keywordsByCategory.industry_terms.length > 0 ? `- Industry Terms: ${keywordsByCategory.industry_terms.join(', ')}` : ''}
`
    : '';

  const response = await anthropic.messages.create({
    model: 'claude-opus-4-5-20251101',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: `Combine and tailor a professional summary for a resume using ONLY the source content provided.

Target Role: ${jdAnalysis.strategic.targetTitle} at ${jdAnalysis.strategic.targetCompany}
Industry: ${jdAnalysis.strategic.industry}

**Positioning Themes** (story to tell):
${jdAnalysis.strategic.positioningThemes.map((t) => `- ${t}`).join('\n')}
${keywordSection}
Format: ${format} (${format === 'long' ? '4-5 sentences' : '3-4 sentences'})

SOURCE CONTENT (use ONLY phrases, claims, and facts from these):

${summaryOptions.map((s, i) => `Option ${i + 1}:\n${s}`).join('\n\n')}

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

Return ONLY the summary text with <mark> tags inline.`,
      },
    ],
  });

  const content = response.content[0];
  if (content.type !== 'text') {
    throw new Error('Unexpected response type');
  }

  return content.text.trim();
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
  unaddressedKeywords?: JDKeyword[]
): Promise<{ overview: string; bullets: string[] }> {
  // Build keyword sections for the prompt
  const keywordsByCategory = unaddressedKeywords
    ? {
        hard_skills: unaddressedKeywords.filter((k) => k.category === 'hard_skill').map((k) => k.keyword),
        soft_skills: unaddressedKeywords.filter((k) => k.category === 'soft_skill').map((k) => k.keyword),
        industry_terms: unaddressedKeywords.filter((k) => k.category === 'industry_term').map((k) => k.keyword),
      }
    : null;

  const keywordSection = keywordsByCategory
    ? `
**ATS Keywords to Mirror** (where natural and authentic):
${keywordsByCategory.hard_skills.length > 0 ? `- Hard Skills: ${keywordsByCategory.hard_skills.join(', ')}` : ''}
${keywordsByCategory.soft_skills.length > 0 ? `- Soft Skills: ${keywordsByCategory.soft_skills.join(', ')}` : ''}
${keywordsByCategory.industry_terms.length > 0 ? `- Industry Terms: ${keywordsByCategory.industry_terms.join(', ')}` : ''}
`
    : '';

  // Build the system context
  const systemContext = `You are helping refine position content on a resume based on user feedback.

Target Role: ${jdAnalysis.strategic.targetTitle} at ${jdAnalysis.strategic.targetCompany}
Industry: ${jdAnalysis.strategic.industry}
Key Themes: ${jdAnalysis.strategic.positioningThemes.join(', ')}
${keywordSection}
Current Overview:
${overview}

Current Bullets:
${bullets.map((b, i) => `${i + 1}. ${b}`).join('\n')}

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

  const content = response.content[0];
  if (content.type !== 'text') {
    throw new Error('Unexpected response type');
  }

  try {
    return JSON.parse(content.text) as { overview: string; bullets: string[] };
  } catch {
    // Try to extract JSON from the response
    const jsonMatch = content.text.match(/\{[\s\S]*\}/);
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

// Regenerate content with a specific keyword incorporated
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
        content: `The user wants to include a specific JD keyword in their resume content.

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

Return ONLY the updated content with <mark> tags inline.`,
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
