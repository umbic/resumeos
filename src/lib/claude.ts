import Anthropic from '@anthropic-ai/sdk';
import type { JDAnalysis, JDKeyword, EnhancedJDAnalysis, GeneratedResume } from '../types';
import { db } from './db';
import { contentItems } from '@/drizzle/schema';
import { eq } from 'drizzle-orm';
import { POSITIONS } from './rules';
import {
  buildMasterGenerationPrompt,
  parseGenerationResponse,
  mapContentItemToPrompt,
  mapContentItemToVariant,
  type PositionContent,
  type PromptContentItem,
  type PromptVariant,
} from './prompts/master-generation';
import { isNotNull, isNull, and } from 'drizzle-orm';

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
  strategic: {
    targetTitle: string;
    targetCompany: string;
    industry: string;
    positioningThemes: Array<{
      theme: string;
      evidence: string;
      jd_quotes: string[];
    }>;
  };
  keywords: Array<{
    keyword: string;
    category: 'hard_skill' | 'soft_skill' | 'industry_term' | 'seniority_signal';
    frequency?: number; // How many times it appears in JD
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

**CRITICAL**: For each positioning theme, you MUST provide:
- **theme**: The strategic angle (e.g., "Transformation leader who modernizes legacy brands")
- **evidence**: WHY this theme matters for this specific JD — cite the language/requirements that make it important
- **jd_quotes**: 2-3 EXACT phrases copied from the JD that support this theme

Example positioning themes with evidence:
- theme: "Transformation leader who modernizes legacy brands"
  evidence: "JD emphasizes modernization across 5 mentions of 'transform', 'evolve', and 'reimagine'"
  jd_quotes: ["transform legacy brand architecture", "evolve brand positioning", "reimagine customer experience"]

- theme: "Data-informed strategist who connects brand to revenue"
  evidence: "Role requires proving marketing ROI and aligning with business metrics"
  jd_quotes: ["demonstrate marketing ROI", "data-driven decision making", "connect brand investment to revenue"]

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
- **frequency**: How many times this keyword (or close variants) appears in the JD
- **priority**: high (frequency 2+), medium (frequency 1), low (nice-to-have or implied)
- **placement**: Where it appeared (title, requirements, responsibilities, nice-to-have)

IMPORTANT: Count actual frequency carefully. If "GTM" appears 3 times in the JD, frequency should be 3.

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
      {
        "theme": "Enterprise brand transformation leader",
        "evidence": "JD mentions 'enterprise-wide brand transformation' as primary responsibility and emphasizes 'modernizing legacy brand architecture'",
        "jd_quotes": ["enterprise-wide brand transformation", "modernize legacy brand architecture", "drive brand evolution"]
      },
      {
        "theme": "Wealth/financial services domain expertise",
        "evidence": "Role requires deep understanding of wealth management clients and regulatory environment",
        "jd_quotes": ["wealth management expertise required", "navigate regulatory requirements", "understand HNW client needs"]
      },
      {
        "theme": "Cross-functional executive who partners with business leaders",
        "evidence": "Multiple references to working across business units and presenting to C-suite",
        "jd_quotes": ["partner with business unit heads", "present to executive leadership", "cross-functional collaboration"]
      }
    ]
  },
  "keywords": [
    {
      "keyword": "brand strategy",
      "category": "hard_skill",
      "frequency": 3,
      "priority": "high",
      "placement": "title, requirements"
    },
    {
      "keyword": "wealth management",
      "category": "industry_term",
      "frequency": 2,
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

  // Helper to repair and parse JSON response
  const repairAndParseJSON = (text: string): RawJDAnalysisResponse => {
    // Remove markdown code fences
    let cleaned = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();

    // Extract JSON object
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON object found in response');
    }
    cleaned = jsonMatch[0];

    // Try direct parse first
    try {
      return JSON.parse(cleaned) as RawJDAnalysisResponse;
    } catch (firstError) {
      console.log('First parse failed, attempting repair...');

      // Repair common JSON issues
      let repaired = cleaned
        // Remove control characters except newlines and tabs
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
        // Fix trailing commas in arrays
        .replace(/,(\s*[\]}])/g, '$1')
        // Fix trailing commas in objects
        .replace(/,(\s*})/g, '$1')
        // Fix missing commas between array elements (}\s*{)
        .replace(/\}(\s*)\{/g, '},$1{')
        // Fix missing commas between string and object in arrays ("text"\s*{)
        .replace(/"(\s*)\{/g, '",$1{')
        // Fix missing commas after strings in arrays ("text"\s*")
        .replace(/"(\s+)"/g, '",$1"');

      try {
        return JSON.parse(repaired) as RawJDAnalysisResponse;
      } catch (secondError) {
        console.log('Second parse failed, trying truncation...', secondError);

        // Try to find the last complete keywords array and truncate there
        // Look for the pattern: "keywords": [...] and ensure it closes properly
        const keywordsMatch = repaired.match(/"keywords"\s*:\s*\[/);
        if (keywordsMatch) {
          const keywordsStart = repaired.indexOf(keywordsMatch[0]);
          const arrayStart = repaired.indexOf('[', keywordsStart);

          // Find matching closing bracket by counting depth
          let depth = 0;
          let lastValidArrayEnd = -1;
          for (let i = arrayStart; i < repaired.length; i++) {
            if (repaired[i] === '[') depth++;
            if (repaired[i] === ']') {
              depth--;
              if (depth === 0) {
                lastValidArrayEnd = i;
                break;
              }
            }
            // Track last complete object in array
            if (repaired[i] === '}' && depth === 1) {
              lastValidArrayEnd = i;
            }
          }

          // If we found an incomplete array, try to close it
          if (lastValidArrayEnd > arrayStart && depth > 0) {
            // Find where to truncate - after last complete object
            const beforeTruncate = repaired.substring(0, lastValidArrayEnd + 1);
            const afterKeywords = repaired.substring(lastValidArrayEnd + 1);

            // Close the array and find remaining structure
            const remainingMatch = afterKeywords.match(/\s*,?\s*"recommendedBrandingMode"[\s\S]*$/);
            if (remainingMatch) {
              repaired = beforeTruncate + '],' + remainingMatch[0].replace(/^\s*,?\s*/, '');
            } else {
              // Just close the structure
              repaired = beforeTruncate + '], "recommendedBrandingMode": "branded", "reasoning": "Unable to parse full response"}';
            }

            try {
              return JSON.parse(repaired) as RawJDAnalysisResponse;
            } catch {
              // Continue to final fallback
            }
          }
        }

        // Final fallback: truncate at last valid structure
        const lastValidClose = Math.max(
          repaired.lastIndexOf('}'),
          repaired.lastIndexOf(']')
        );

        if (lastValidClose > 0) {
          let depth = 0;
          let truncatePoint = -1;
          for (let i = lastValidClose; i >= 0; i--) {
            const char = repaired[i];
            if (char === '}' || char === ']') depth++;
            if (char === '{' || char === '[') depth--;
            if (depth === 0 && char === '{') {
              truncatePoint = lastValidClose + 1;
              break;
            }
          }

          if (truncatePoint > 0) {
            const truncated = repaired.substring(0, truncatePoint);
            try {
              return JSON.parse(truncated) as RawJDAnalysisResponse;
            } catch {
              // Continue to throw original error
            }
          }
        }

        throw firstError;
      }
    }
  };

  try {
    const parsed = repairAndParseJSON(content.text);
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
  } catch (parseError) {
    console.error('JSON parse error:', parseError);
    console.error('Response text (first 500 chars):', content.text.substring(0, 500));
    throw new Error(`Failed to parse JD analysis response: ${parseError}`);
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

export async function refineSummary(
  currentSummary: string,
  jdAnalysis: JDAnalysis,
  conversationHistory: ConversationMessage[],
  instructions: string,
  usedVerbs: string[] = []
): Promise<{ content: string; detectedVerbs: string[] }> {
  const systemContext = `You are helping refine a professional summary based on user feedback.

TARGET: ${jdAnalysis.strategic.targetTitle} at ${jdAnalysis.strategic.targetCompany}
INDUSTRY: ${jdAnalysis.strategic.industry}

CURRENT SUMMARY:
${currentSummary}

RULES:
1. Never change metrics or facts
2. Never add industries not in original
3. Maintain executive tone
4. Used verbs (avoid): ${usedVerbs.join(', ') || 'None'}

Apply the user's requested changes while maintaining quality.
Wrap changes in <mark> tags.

Return ONLY the updated summary.`;

  const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [
    { role: 'user', content: systemContext },
    { role: 'assistant', content: "I understand. I'll help refine this summary while preserving all facts and metrics." },
    ...conversationHistory,
    { role: 'user', content: instructions },
  ];

  const response = await anthropic.messages.create({
    model: 'claude-opus-4-5-20251101',
    max_tokens: 1024,
    messages,
  });

  const responseContent = response.content[0];
  const content = responseContent.type === 'text' ? responseContent.text.trim() : '';

  return {
    content,
    detectedVerbs: extractVerbsFromContent(content),
  };
}

export async function refineHighlights(
  currentHighlights: string[],
  jdAnalysis: JDAnalysis,
  conversationHistory: ConversationMessage[],
  instructions: string,
  usedVerbs: string[] = []
): Promise<{ content: string[]; detectedVerbs: string[] }> {
  const systemContext = `You are helping refine career highlights based on user feedback.

TARGET: ${jdAnalysis.strategic.targetTitle} at ${jdAnalysis.strategic.targetCompany}
INDUSTRY: ${jdAnalysis.strategic.industry}

CURRENT HIGHLIGHTS:
${currentHighlights.map((h, i) => `${i + 1}. ${h}`).join('\n')}

RULES:
1. Never change metrics, numbers, or facts
2. Never add industries not in original
3. Keep the bold hook phrase + supporting text format
4. Used verbs (avoid): ${usedVerbs.join(', ') || 'None'}

Apply the user's requested changes while maintaining quality.
Wrap changes in <mark> tags.

Return a JSON array of the updated highlights:
["highlight 1 with <mark>changes</mark>", "highlight 2", ...]

Return ONLY the JSON array, no other text.`;

  const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [
    { role: 'user', content: systemContext },
    { role: 'assistant', content: "I understand. I'll help refine these career highlights while preserving all facts and metrics." },
    ...conversationHistory,
    { role: 'user', content: instructions },
  ];

  const response = await anthropic.messages.create({
    model: 'claude-opus-4-5-20251101',
    max_tokens: 2048,
    messages,
  });

  const responseContent = response.content[0];
  if (responseContent.type !== 'text') {
    return { content: currentHighlights, detectedVerbs: [] };
  }

  try {
    const highlights = JSON.parse(responseContent.text) as string[];
    const allContent = highlights.join(' ');
    return {
      content: highlights,
      detectedVerbs: extractVerbsFromContent(allContent),
    };
  } catch {
    // Try to extract JSON from the response
    const jsonMatch = responseContent.text.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const highlights = JSON.parse(jsonMatch[0]) as string[];
      const allContent = highlights.join(' ');
      return {
        content: highlights,
        detectedVerbs: extractVerbsFromContent(allContent),
      };
    }
    return { content: currentHighlights, detectedVerbs: [] };
  }
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

// ============================================
// V1.5 One-Shot Generation Functions
// ============================================

/**
 * Fetch all summary content items from the database
 */
async function fetchAllSummaries(): Promise<PromptContentItem[]> {
  const results = await db
    .select()
    .from(contentItems)
    .where(eq(contentItems.type, 'summary'));

  return results.map(mapContentItemToPrompt);
}

/**
 * Fetch all career highlight base items from the database (excludes variants)
 */
async function fetchAllCareerHighlights(): Promise<PromptContentItem[]> {
  const results = await db
    .select()
    .from(contentItems)
    .where(and(
      eq(contentItems.type, 'career_highlight'),
      isNull(contentItems.baseId) // Exclude variants
    ));

  return results.map(mapContentItemToPrompt);
}

/**
 * Fetch all career highlight variants from the database
 */
async function fetchCareerHighlightVariants(): Promise<PromptVariant[]> {
  const results = await db
    .select()
    .from(contentItems)
    .where(and(
      eq(contentItems.type, 'career_highlight'),
      isNotNull(contentItems.baseId) // Only variants
    ));

  return results.map(mapContentItemToVariant);
}

/**
 * Fetch position bullet variants from the database
 */
async function fetchPositionVariants(position?: number): Promise<PromptVariant[]> {
  const results = await db
    .select()
    .from(contentItems)
    .where(and(
      eq(contentItems.type, 'bullet'),
      isNotNull(contentItems.baseId), // Only variants
      position !== undefined ? eq(contentItems.position, position) : undefined
    ));

  return results.map(mapContentItemToVariant);
}

/**
 * Fetch all position content (overviews and base bullets) from the database
 */
async function fetchAllPositionContent(): Promise<PositionContent[]> {
  // Fetch overviews
  const overviews = await db
    .select()
    .from(contentItems)
    .where(eq(contentItems.type, 'overview'));

  // Fetch bullets (base items only, exclude variants)
  const bullets = await db
    .select()
    .from(contentItems)
    .where(and(
      eq(contentItems.type, 'bullet'),
      isNull(contentItems.baseId) // Exclude variants
    ));

  // Map overviews and bullets by position
  const overviewsByPosition: Record<number, PromptContentItem> = {};
  for (const ov of overviews) {
    if (ov.position !== null) {
      overviewsByPosition[ov.position] = mapContentItemToPrompt(ov);
    }
  }

  const bulletsByPosition: Record<number, PromptContentItem[]> = {};
  for (const b of bullets) {
    if (b.position !== null) {
      if (!bulletsByPosition[b.position]) {
        bulletsByPosition[b.position] = [];
      }
      bulletsByPosition[b.position].push(mapContentItemToPrompt(b));
    }
  }

  // Combine with position metadata
  return POSITIONS.map((pos) => ({
    position: pos.number,
    title: pos.titleDefault,
    company: pos.company,
    dates: pos.dates,
    location: pos.location,
    overview: overviewsByPosition[pos.number] || null,
    bullets: bulletsByPosition[pos.number] || [],
  }));
}

/**
 * Generate a complete resume in one shot using the master generation prompt.
 * This is the core V1.5 generation function with three-level variant matching.
 */
export async function generateFullResume(input: {
  jdAnalysis: EnhancedJDAnalysis;
  format: 'long' | 'short';
  brandingMode: 'branded' | 'generic';
  targetCompany: string;
}): Promise<GeneratedResume> {
  // Fetch all content from database
  const summaries = await fetchAllSummaries();
  const careerHighlights = await fetchAllCareerHighlights();
  const careerHighlightVariants = await fetchCareerHighlightVariants();
  const positionContent = await fetchAllPositionContent();

  // Fetch P1 and P2 variants
  const p1Variants = await fetchPositionVariants(1);
  const p2Variants = await fetchPositionVariants(2);
  const positionVariants = [...p1Variants, ...p2Variants];

  const prompt = buildMasterGenerationPrompt({
    ...input,
    summaries,
    careerHighlights,
    careerHighlightVariants,
    positionContent,
    positionVariants,
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

// Re-export for convenience
export { buildMasterGenerationPrompt, parseGenerationResponse };

export default anthropic;
