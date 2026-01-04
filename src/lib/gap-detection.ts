import type {
  Gap,
  GapRecommendation,
  EnhancedJDAnalysis,
  GeneratedResume,
  ATSKeyword,
  KeywordGap
} from '@/types';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic();

/**
 * Detect gaps between JD priority themes and what the resume addresses.
 * Only surfaces actionable gaps with reframing opportunities.
 */
export async function detectGaps(
  jdAnalysis: EnhancedJDAnalysis,
  generatedResume: GeneratedResume
): Promise<Gap[]> {
  const gaps: Gap[] = [];

  // Check priority themes only (not secondary)
  for (const theme of jdAnalysis.priority_themes) {
    const isAddressed = generatedResume.themes_addressed.some(
      t => t.toLowerCase().includes(theme.theme.toLowerCase()) ||
           theme.theme.toLowerCase().includes(t.toLowerCase())
    );

    if (!isAddressed) {
      // This is a gap — check if it's addressable
      const recommendation = await findReframingOpportunity(theme.theme, generatedResume);

      gaps.push({
        id: `gap-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        theme: theme.theme,
        severity: 'critical', // Priority themes are always critical
        reason: `JD emphasizes "${theme.theme}" but resume doesn't address it.`,
        recommendation,
        status: 'open',
      });
    }
  }

  // Limit to top 3 most important gaps
  return gaps.slice(0, 3);
}

/**
 * Get all text from a resume for keyword searching
 */
function getAllResumeText(resume: GeneratedResume): string {
  const parts: string[] = [
    resume.summary,
    ...resume.career_highlights,
    ...resume.positions.flatMap(p => [
      p.overview,
      ...(p.bullets || []),
    ]),
  ];
  return parts.join(' ').toLowerCase();
}

/**
 * Detect keyword gaps between JD ATS keywords and what's in the resume.
 * Only checks high-priority keywords (frequency 2+).
 */
export function detectKeywordGaps(
  atsKeywords: ATSKeyword[],
  generatedResume: GeneratedResume
): KeywordGap[] {
  const gaps: KeywordGap[] = [];
  const resumeText = getAllResumeText(generatedResume);

  // Only check high-priority keywords (frequency 2+)
  const highPriorityKeywords = atsKeywords.filter(k => k.priority === 'high');

  for (const kw of highPriorityKeywords) {
    const keywordLower = kw.keyword.toLowerCase();

    // Check if keyword appears in resume (exact match or close variant)
    const found = resumeText.includes(keywordLower) ||
      // Also check common variants
      (keywordLower === 'gtm' && resumeText.includes('go-to-market')) ||
      (keywordLower === 'go-to-market' && resumeText.includes('gtm')) ||
      (keywordLower === 'saas' && resumeText.includes('software as a service')) ||
      (keywordLower === 'b2b' && resumeText.includes('business-to-business')) ||
      (keywordLower === 'api' && (resumeText.includes('apis') || resumeText.includes('api ')));

    if (!found) {
      gaps.push({
        keyword: kw.keyword,
        frequency_in_jd: kw.frequency,
        found_in_resume: false,
        suggestion: suggestKeywordPlacement(kw.keyword, kw.category),
      });
    }
  }

  // Sort by frequency (most important first)
  return gaps.sort((a, b) => b.frequency_in_jd - a.frequency_in_jd);
}

/**
 * Suggest where a keyword could be placed based on its category
 */
function suggestKeywordPlacement(keyword: string, category?: string): string {
  switch (category) {
    case 'hard_skill':
      return `Consider adding "${keyword}" to Summary or Career Highlights`;
    case 'industry_term':
      return `Consider integrating "${keyword}" into position overviews`;
    case 'soft_skill':
      return `Consider weaving "${keyword}" into leadership descriptions`;
    case 'seniority_signal':
      return `Consider highlighting "${keyword}" in Summary`;
    default:
      return `Consider adding "${keyword}" naturally to relevant sections`;
  }
}

/**
 * Calculate keyword coverage percentage
 */
export function calculateActualKeywordCoverage(
  atsKeywords: ATSKeyword[],
  generatedResume: GeneratedResume
): number {
  const highPriorityKeywords = atsKeywords.filter(k => k.priority === 'high');

  if (highPriorityKeywords.length === 0) return 100;

  const resumeText = getAllResumeText(generatedResume);

  const found = highPriorityKeywords.filter(kw => {
    const keywordLower = kw.keyword.toLowerCase();
    return resumeText.includes(keywordLower) ||
      (keywordLower === 'gtm' && resumeText.includes('go-to-market')) ||
      (keywordLower === 'go-to-market' && resumeText.includes('gtm')) ||
      (keywordLower === 'saas' && resumeText.includes('software as a service')) ||
      (keywordLower === 'b2b' && resumeText.includes('business-to-business')) ||
      (keywordLower === 'api' && (resumeText.includes('apis') || resumeText.includes('api ')));
  });

  return Math.round((found.length / highPriorityKeywords.length) * 100);
}

/**
 * Use Claude to identify if any existing content could be reframed to address a theme.
 */
async function findReframingOpportunity(
  theme: string,
  resume: GeneratedResume
): Promise<GapRecommendation | undefined> {
  const prompt = `You are analyzing a resume to find reframing opportunities.

## GAP THEME
The job description emphasizes: "${theme}"
But the resume doesn't explicitly address this.

## CURRENT RESUME CONTENT

### Summary
${resume.summary}

### Career Highlights
${resume.career_highlights.map((h, i) => `${i + 1}. ${h}`).join('\n')}

### Position 1 Overview
${resume.positions[0]?.overview || 'N/A'}

### Position 2 Overview
${resume.positions[1]?.overview || 'N/A'}

## YOUR TASK

Is there existing content that could be REFRAMED to address "${theme}"?

Look for:
- Similar concepts described differently
- Adjacent experiences that imply this capability
- Results that demonstrate this skill without naming it

If you find a reframing opportunity, return JSON:
{
  "found": true,
  "affected_sections": ["summary", "position_1_overview"],
  "suggestion": "Your pharma work (Position 1) demonstrates trust messaging for regulated industries. Reframe to emphasize compliance and safety narrative capabilities.",
  "specific_content": "The J&J pharma work and financial services data privacy experience"
}

If no reasonable reframing exists, return:
{
  "found": false,
  "reason": "No existing content maps to this theme"
}

Return ONLY valid JSON.`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';

    // Extract JSON from response (handle markdown code blocks)
    let jsonText = text.trim();
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.slice(7);
    }
    if (jsonText.startsWith('```')) {
      jsonText = jsonText.slice(3);
    }
    if (jsonText.endsWith('```')) {
      jsonText = jsonText.slice(0, -3);
    }

    const result = JSON.parse(jsonText.trim());

    if (result.found) {
      return {
        affectedSections: result.affected_sections,
        suggestion: result.suggestion,
        contentToReframe: result.specific_content,
      };
    }

    return undefined;
  } catch (error) {
    console.error('Error finding reframing opportunity:', error);
    return undefined;
  }
}

/**
 * Address a gap by regenerating affected sections with the theme context.
 */
export async function addressGap(
  sessionId: string,
  gapId: string,
  resume: GeneratedResume,
  gap: Gap
): Promise<GeneratedResume> {
  if (!gap.recommendation) {
    throw new Error('Gap has no recommendation to address');
  }

  // Generate targeted updates for affected sections
  const prompt = `You are updating specific sections of a resume to address a gap.

## GAP TO ADDRESS
Theme: ${gap.theme}
Suggestion: ${gap.recommendation.suggestion}
Sections to update: ${gap.recommendation.affectedSections.join(', ')}

## CURRENT CONTENT

${gap.recommendation.affectedSections.map(section => {
  if (section === 'summary') return `### Summary\n${resume.summary}`;
  if (section.includes('position')) {
    const posNum = parseInt(section.split('_')[1]);
    const pos = resume.positions.find(p => p.number === posNum);
    return `### Position ${posNum} Overview\n${pos?.overview || 'N/A'}`;
  }
  if (section.includes('highlight')) {
    const idx = parseInt(section.split('_')[1]) - 1;
    return `### Career Highlight ${idx + 1}\n${resume.career_highlights[idx] || 'N/A'}`;
  }
  return '';
}).join('\n\n')}

## YOUR TASK

Rewrite ONLY the affected sections to address "${gap.theme}".

Rules:
- Make minimal changes — don't rewrite entirely
- Integrate the theme naturally, don't force it
- Keep all metrics and facts unchanged
- Maximum 40 words per bullet
- Keep executive tone

Return JSON:
{
  "updated_sections": {
    "summary": "new summary text if affected",
    "position_1_overview": "new overview if affected"
  }
}

Only include sections you actually changed. Return ONLY valid JSON.`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2000,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';

  // Extract JSON from response
  let jsonText = text.trim();
  if (jsonText.startsWith('```json')) {
    jsonText = jsonText.slice(7);
  }
  if (jsonText.startsWith('```')) {
    jsonText = jsonText.slice(3);
  }
  if (jsonText.endsWith('```')) {
    jsonText = jsonText.slice(0, -3);
  }

  const updates = JSON.parse(jsonText.trim());

  // Apply updates to resume
  const updatedResume = { ...resume };

  for (const [section, content] of Object.entries(updates.updated_sections)) {
    if (section === 'summary') {
      updatedResume.summary = content as string;
    } else if (section.startsWith('position_')) {
      const posNum = parseInt(section.split('_')[1]);
      updatedResume.positions = resume.positions.map(p => {
        if (p.number === posNum && section.includes('overview')) {
          return { ...p, overview: content as string };
        }
        return p;
      });
    } else if (section.startsWith('highlight_')) {
      const idx = parseInt(section.split('_')[1]) - 1;
      updatedResume.career_highlights = [...resume.career_highlights];
      updatedResume.career_highlights[idx] = content as string;
    }
  }

  // Mark theme as now addressed
  if (!updatedResume.themes_addressed.includes(gap.theme)) {
    updatedResume.themes_addressed = [...updatedResume.themes_addressed, gap.theme];
  }
  updatedResume.themes_not_addressed = updatedResume.themes_not_addressed.filter(
    t => t !== gap.theme
  );

  return updatedResume;
}
