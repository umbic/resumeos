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
    model: 'claude-sonnet-4-20250514',
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
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: `You are helping tailor resume content for a specific job application.

Target Role: ${jdAnalysis.targetTitle} at ${jdAnalysis.targetCompany}
Industry: ${jdAnalysis.industry}
Key Themes: ${jdAnalysis.themes.join(', ')}
Keywords: ${jdAnalysis.keywords.join(', ')}

Original Content (${sectionType}):
${originalContent}

${instructions ? `Additional Instructions: ${instructions}` : ''}

Reframe this content to emphasize aspects most relevant to the target role.

You MAY:
- Reorder emphasis
- Use industry-specific language that matches the JD
- Mirror JD terminology where authentic

You may NOT:
- Change any metrics or numbers
- Add capabilities not present in the original
- Fabricate clients or experiences
- Inflate scope or scale

Return ONLY the tailored content, no explanation or preamble.`,
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
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: `Generate a tailored professional summary for a resume.

Target Role: ${jdAnalysis.targetTitle} at ${jdAnalysis.targetCompany}
Industry: ${jdAnalysis.industry}
Key Themes: ${jdAnalysis.themes.join(', ')}
Format: ${format} (${format === 'long' ? '4-5 sentences' : '3-4 sentences'})

Here are pre-approved summary options to draw from - you MUST use only content from these:

${summaryOptions.map((s, i) => `Option ${i + 1}:\n${s}`).join('\n\n')}

Create a summary that:
1. Leads with the capability most relevant to this JD
2. Emphasizes outcomes the JD cares about
3. Uses industry-appropriate language
4. Maintains all factual claims from the source options

Return ONLY the summary text, no explanation.`,
      },
    ],
  });

  const content = response.content[0];
  if (content.type !== 'text') {
    throw new Error('Unexpected response type');
  }

  return content.text.trim();
}

export default anthropic;
