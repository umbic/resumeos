import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export interface JDAnalysis {
  targetTitle: string;
  targetCompany: string;
  industry: string;
  keywords: string[];
  themes: string[];
  recommendedBrandingMode: 'branded' | 'generic';
  reasoning: string;
}

export async function analyzeJobDescription(jobDescription: string): Promise<JDAnalysis> {
  const response = await anthropic.messages.create({
    model: 'claude-opus-4-5-20251101',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: `Analyze this job description and extract key information for resume customization.

Job Description:
${jobDescription}

Return a JSON object with:
1. targetTitle: The exact job title (as it should appear on a resume header)
2. targetCompany: The company name
3. industry: The industry/sector (e.g., "Financial Services", "Healthcare", "Technology")
4. keywords: Array of 8-12 key skills/keywords for ATS optimization
5. themes: Array of 3-5 strategic positioning themes to emphasize
6. recommendedBrandingMode: "branded" or "generic" - use "generic" if the company is McKinsey, BCG, Bain, Accenture, EY, KPMG, PwC, WPP, Publicis, IPG, or Dentsu
7. reasoning: Brief explanation of branding recommendation

Return ONLY the JSON object, no other text.`,
      },
    ],
  });

  const content = response.content[0];
  if (content.type !== 'text') {
    throw new Error('Unexpected response type');
  }

  try {
    return JSON.parse(content.text) as JDAnalysis;
  } catch {
    // Try to extract JSON from the response
    const jsonMatch = content.text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]) as JDAnalysis;
    }
    throw new Error('Failed to parse JD analysis response');
  }
}

export async function generateTailoredContent(
  originalContent: string,
  jdAnalysis: JDAnalysis,
  sectionType: string,
  instructions?: string
): Promise<string> {
  const response = await anthropic.messages.create({
    model: 'claude-opus-4-5-20251101',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: `Tailor this resume content for a specific job application. You must preserve all facts from the original.

Target Role: ${jdAnalysis.targetTitle} at ${jdAnalysis.targetCompany}
Industry: ${jdAnalysis.industry}
Key Themes: ${jdAnalysis.themes.join(', ')}
Keywords: ${jdAnalysis.keywords.join(', ')}

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

Wrap customized words/phrases in <mark> tags. Only mark actual changes.

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
  format: 'long' | 'short'
): Promise<string> {
  const response = await anthropic.messages.create({
    model: 'claude-opus-4-5-20251101',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: `Combine and tailor a professional summary for a resume using ONLY the source content provided.

Target Role: ${jdAnalysis.targetTitle} at ${jdAnalysis.targetCompany}
Industry: ${jdAnalysis.industry}
Key Themes: ${jdAnalysis.themes.join(', ')}
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

Wrap customized words/phrases in <mark> tags. Only mark actual changes, not unchanged source content.

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
  conversationHistory?: ConversationMessage[]
): Promise<{ overview: string; bullets: string[] }> {
  // Build the system context
  const systemContext = `You are helping refine position content on a resume based on user feedback.

Target Role: ${jdAnalysis.targetTitle} at ${jdAnalysis.targetCompany}
Industry: ${jdAnalysis.industry}
Key Themes: ${jdAnalysis.themes.join(', ')}

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

Wrap customized words/phrases in <mark> tags. Preserve existing <mark> tags if that text remains customized.

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

export default anthropic;
