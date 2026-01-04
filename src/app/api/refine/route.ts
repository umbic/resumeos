import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import Anthropic from '@anthropic-ai/sdk';
import type { GeneratedResume, EnhancedJDAnalysis, JDAnalysis } from '@/types';

const anthropic = new Anthropic();

export async function POST(request: NextRequest) {
  try {
    const {
      sessionId,
      section, // 'summary' | 'highlight_1' | 'position_1_overview' | 'position_1_bullet_1' etc.
      instruction,
      conversationHistory = []
    } = await request.json();

    if (!sessionId || !section || !instruction) {
      return NextResponse.json(
        { error: 'sessionId, section, and instruction are required' },
        { status: 400 }
      );
    }

    // Get current resume
    const sessionResult = await sql`
      SELECT generated_resume, jd_analysis, used_verbs, used_phrases, target_title, target_company
      FROM sessions
      WHERE id = ${sessionId}
    `;

    if (sessionResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    const session = sessionResult.rows[0];

    if (!session.generated_resume) {
      return NextResponse.json(
        { error: 'No generated resume found. Generate a resume first.' },
        { status: 400 }
      );
    }

    const resume = session.generated_resume as GeneratedResume;
    const usedVerbs = session.used_verbs || [];
    const usedPhrases = session.used_phrases || [];

    // Get current content for this section
    const currentContent = extractSectionContent(resume, section);

    if (!currentContent) {
      return NextResponse.json(
        { error: `Section "${section}" not found in resume` },
        { status: 400 }
      );
    }

    // Build refinement prompt
    const prompt = buildRefinementPrompt({
      section,
      currentContent,
      instruction,
      conversationHistory,
      usedVerbs,
      usedPhrases,
      jdAnalysis: session.jd_analysis,
      targetTitle: session.target_title,
      targetCompany: session.target_company,
    });

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [
        { role: 'user', content: prompt },
      ],
    });

    const refinedContent = response.content[0].type === 'text'
      ? response.content[0].text.trim()
      : '';

    // Update the resume with refined content
    const updatedResume = updateSectionContent(resume, section, refinedContent);

    // Save back to database
    await sql`
      UPDATE sessions
      SET
        generated_resume = ${JSON.stringify(updatedResume)}::jsonb,
        updated_at = NOW()
      WHERE id = ${sessionId}
    `;

    return NextResponse.json({
      success: true,
      section,
      refined_content: refinedContent,
      resume: updatedResume,
    });

  } catch (error) {
    console.error('Refine error:', error);
    return NextResponse.json(
      { error: 'Failed to refine content', details: String(error) },
      { status: 500 }
    );
  }
}

function extractSectionContent(resume: GeneratedResume, section: string): string {
  if (section === 'summary') {
    return resume.summary;
  }

  if (section.startsWith('highlight_')) {
    const index = parseInt(section.split('_')[1]) - 1;
    return resume.career_highlights[index] || '';
  }

  if (section.startsWith('position_')) {
    const parts = section.split('_');
    const posNum = parseInt(parts[1]);
    const position = resume.positions.find(p => p.number === posNum);

    if (!position) return '';

    if (parts[2] === 'overview') {
      return position.overview;
    }

    if (parts[2] === 'bullet') {
      const bulletIndex = parseInt(parts[3]) - 1;
      return position.bullets?.[bulletIndex] || '';
    }
  }

  return '';
}

function updateSectionContent(
  resume: GeneratedResume,
  section: string,
  newContent: string
): GeneratedResume {
  const updated = { ...resume };

  if (section === 'summary') {
    updated.summary = newContent;
  } else if (section.startsWith('highlight_')) {
    const index = parseInt(section.split('_')[1]) - 1;
    updated.career_highlights = [...resume.career_highlights];
    updated.career_highlights[index] = newContent;
  } else if (section.startsWith('position_')) {
    const parts = section.split('_');
    const posNum = parseInt(parts[1]);

    updated.positions = resume.positions.map(p => {
      if (p.number !== posNum) return p;

      const updatedPos = { ...p };

      if (parts[2] === 'overview') {
        updatedPos.overview = newContent;
      } else if (parts[2] === 'bullet' && updatedPos.bullets) {
        const bulletIndex = parseInt(parts[3]) - 1;
        updatedPos.bullets = [...updatedPos.bullets];
        updatedPos.bullets[bulletIndex] = newContent;
      }

      return updatedPos;
    });
  }

  return updated;
}

function buildRefinementPrompt(input: {
  section: string;
  currentContent: string;
  instruction: string;
  conversationHistory: Array<{ role: string; content: string }>;
  usedVerbs: string[];
  usedPhrases: string[];
  jdAnalysis: JDAnalysis | EnhancedJDAnalysis | null;
  targetTitle: string;
  targetCompany: string;
}): string {
  // Extract theme info from either analysis format
  let priorityThemes: string[] = [];
  if (input.jdAnalysis) {
    if ('priority_themes' in input.jdAnalysis) {
      // EnhancedJDAnalysis
      priorityThemes = input.jdAnalysis.priority_themes.map(t => t.theme);
    } else if ('strategic' in input.jdAnalysis) {
      // JDAnalysis
      priorityThemes = input.jdAnalysis.strategic.positioningThemes;
    }
  }

  return `You are refining a section of an executive resume.

## CURRENT CONTENT
${input.currentContent}

## USER INSTRUCTION
${input.instruction}

## CONVERSATION HISTORY
${input.conversationHistory.map(m => `${m.role}: ${m.content}`).join('\n') || 'No previous conversation'}

## RULES (Still Apply)
- Maximum 40 words for bullets
- Preserve all metrics and facts exactly
- Don't use these verbs (already used): ${input.usedVerbs.join(', ') || 'None'}
- Don't use these phrases more than 2x: ${input.usedPhrases.join(', ') || 'None'}
- Keep language executive-level, not robotic
- No jargon soup (compound noun chains like "B2B enterprise technology platform partner")

## JD CONTEXT
Target: ${input.targetTitle} at ${input.targetCompany}
Priority themes: ${priorityThemes.join(', ') || 'Not specified'}

Return ONLY the refined content. No explanation, no markdown, just the text.`;
}
