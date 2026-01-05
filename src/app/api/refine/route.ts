import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import Anthropic from '@anthropic-ai/sdk';
import { v4 as uuidv4 } from 'uuid';
import type { GeneratedResume, EnhancedJDAnalysis, JDAnalysis, RefinementMessage } from '@/types';

const anthropic = new Anthropic();

export async function POST(request: NextRequest) {
  try {
    const {
      sessionId,
      sectionKey,      // 'summary' | 'highlight_1' | 'position_1_overview' | 'position_1_bullet_1' etc.
      currentContent,  // Current text of the section
      userMessage,     // What user wants changed
    } = await request.json();

    if (!sessionId || !sectionKey || !userMessage) {
      return NextResponse.json(
        { error: 'sessionId, sectionKey, and userMessage are required' },
        { status: 400 }
      );
    }

    // Fetch full session data for context
    const sessionResult = await sql`
      SELECT
        job_description,
        jd_analysis,
        generated_resume,
        refinement_history,
        used_verbs,
        used_phrases,
        target_title,
        target_company
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
    const jdAnalysis = session.jd_analysis as EnhancedJDAnalysis | JDAnalysis | null;
    const jobDescription = session.job_description || '';
    const refinementHistory = (session.refinement_history || []) as RefinementMessage[];

    // Filter chat history to only this section
    const sectionHistory = refinementHistory.filter(m => m.section === sectionKey);

    // Build the comprehensive refinement prompt
    const prompt = buildRefinementPrompt({
      jobDescription,
      jdAnalysis,
      fullResume: resume,
      sectionKey,
      currentContent,
      chatHistory: sectionHistory,
      userRequest: userMessage,
      usedVerbs: session.used_verbs || [],
      usedPhrases: session.used_phrases || [],
    });

    // Log the full prompt for debugging
    console.log('========== REFINEMENT PROMPT ==========');
    console.log(prompt);
    console.log('========== END PROMPT ==========');

    // Call Claude
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }],
    });

    const refinedContent = response.content[0].type === 'text'
      ? response.content[0].text.trim()
      : '';

    // Create new chat messages
    const newMessages: RefinementMessage[] = [
      {
        id: uuidv4(),
        section: sectionKey,
        role: 'user',
        content: userMessage,
        timestamp: new Date().toISOString(),
      },
      {
        id: uuidv4(),
        section: sectionKey,
        role: 'assistant',
        content: refinedContent,
        timestamp: new Date().toISOString(),
      },
    ];

    // Update the resume with refined content
    const updatedResume = updateSectionContent(resume, sectionKey, refinedContent);

    // Append chat history and update resume
    const updatedHistory = [...refinementHistory, ...newMessages];

    await sql`
      UPDATE sessions
      SET
        generated_resume = ${JSON.stringify(updatedResume)}::jsonb,
        refinement_history = ${JSON.stringify(updatedHistory)}::jsonb,
        updated_at = NOW()
      WHERE id = ${sessionId}
    `;

    return NextResponse.json({
      success: true,
      refinedContent,
      chatHistory: updatedHistory.filter(m => m.section === sectionKey),
    });

  } catch (error) {
    console.error('Refine error:', error);
    return NextResponse.json(
      { error: 'Failed to refine content', details: String(error) },
      { status: 500 }
    );
  }
}

// ============================================
// Helper Functions
// ============================================

function getSectionDisplayName(sectionKey: string): string {
  if (sectionKey === 'summary') return 'Summary';

  if (sectionKey.startsWith('highlight_')) {
    const num = sectionKey.split('_')[1];
    return `Career Highlight ${num}`;
  }

  if (sectionKey.startsWith('position_')) {
    const parts = sectionKey.split('_');
    const posNum = parts[1];
    const field = parts[2];

    if (field === 'overview') {
      return `Position ${posNum} Overview`;
    }
    if (field === 'bullet') {
      return `Position ${posNum} Bullet ${parts[3]}`;
    }
  }

  return sectionKey;
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

interface RefinementPromptInput {
  jobDescription: string;
  jdAnalysis: EnhancedJDAnalysis | JDAnalysis | null;
  fullResume: GeneratedResume;
  sectionKey: string;
  currentContent: string;
  chatHistory: RefinementMessage[];
  userRequest: string;
  usedVerbs: string[];
  usedPhrases: string[];
}

function buildRefinementPrompt(input: RefinementPromptInput): string {
  const {
    jobDescription,
    jdAnalysis,
    fullResume,
    sectionKey,
    currentContent,
    chatHistory,
    userRequest,
    usedVerbs,
    // usedPhrases - removed from prompt, keeping in interface for future use
  } = input;

  const sectionName = getSectionDisplayName(sectionKey);

  // Extract JD analysis info based on format
  let targetTitle = '';
  let targetCompany = '';
  let priorityThemes: string[] = [];
  let atsKeywords: string[] = [];

  if (jdAnalysis) {
    if ('priority_themes' in jdAnalysis) {
      // EnhancedJDAnalysis
      targetTitle = jdAnalysis.target_title;
      targetCompany = jdAnalysis.target_company;
      priorityThemes = jdAnalysis.priority_themes.map(t => t.theme);
      atsKeywords = jdAnalysis.ats_keywords.map(k => `${k.keyword} (${k.frequency}x)`);
    } else if ('strategic' in jdAnalysis) {
      // JDAnalysis
      targetTitle = jdAnalysis.strategic.targetTitle;
      targetCompany = jdAnalysis.strategic.targetCompany;
      // Handle both new format (objects) and legacy format (strings)
      priorityThemes = jdAnalysis.strategic.positioningThemes.map(t =>
        typeof t === 'string' ? t : t.theme
      );
    }
  }

  // Build positions section for context
  const positionsText = fullResume.positions.map(p => {
    let posText = `\n**${p.title}** | ${p.company} | ${p.dates}\n${p.overview}`;
    if (p.bullets && p.bullets.length > 0) {
      posText += '\n' + p.bullets.map(b => `• ${b}`).join('\n');
    }
    return posText;
  }).join('\n');

  // Build chat history section
  const historyText = chatHistory.length > 0
    ? chatHistory.map(m => `**${m.role === 'user' ? 'User' : 'Claude'}**: ${m.content}`).join('\n\n')
    : '';

  return `You are refining a specific section of an executive resume. You have full context of the job description and entire resume.

## TARGET ROLE
**Title**: ${targetTitle || 'Not specified'}
**Company**: ${targetCompany || 'Not specified'}

## PRIORITY THEMES (from JD analysis)
${priorityThemes.length > 0 ? priorityThemes.map(t => `- ${t}`).join('\n') : '- None specified'}

## ATS KEYWORDS TO CONSIDER
${atsKeywords.length > 0 ? atsKeywords.map(k => `- ${k}`).join('\n') : '- None specified'}

## FULL JOB DESCRIPTION
${jobDescription || 'Not provided'}

---

## CURRENT FULL RESUME

### Summary
${fullResume.summary}

### Career Highlights
${fullResume.career_highlights.map((h, i) => `${i + 1}. ${h}`).join('\n')}

### Positions
${positionsText}

---

## SECTION TO REFINE
**Section**: ${sectionName}

**Current Content**:
${currentContent}

${historyText ? `
## PREVIOUS REFINEMENT CONVERSATION
${historyText}
` : ''}

## USER REQUEST
${userRequest}

---

## INSTRUCTIONS

Refine the "${sectionName}" section using the user's request as CREATIVE DIRECTION.

### CRITICAL: You Are a Writer, Not a Transcriber

The user's request describes their INTENT. Your job is to:
1. Understand what they want to achieve
2. Write compelling executive content that fulfills that intent
3. Make it BETTER than they described — you have the JD context, use it

DO NOT:
- Transcribe their words back as content
- Copy their phrasing verbatim
- Produce mechanical, literal interpretations

DO:
- Use strong action verbs (architected, pioneered, transformed, drove)
- Create narrative flow with clear cause → action → result
- Naturally weave in JD priority themes where they fit
- Write something that sounds like a polished executive resume, not a description of what should be in one

### Example

User request: "make it about sales enablement and product strategy, keep the metrics"

BAD (literal transcription):
"Developed sales enablement and product strategy initiatives that drove 9% customer acquisition."

GOOD (creative interpretation):
"Architected category-defining brand positioning that armed sales teams with differentiated product narratives, accelerating 9% customer acquisition and 64% revenue growth across enterprise accounts."

### Content Rules
- Factual accuracy — don't invent metrics, clients, or claims
- Length limits: Bullets ≤40 words, Highlights 40-55 words, Summary 50-75 words
- Avoid verbs already used: ${usedVerbs.join(', ') || 'None'}
- No jargon soup (compound noun chains)
- Executive tone — confident, specific, results-oriented

Return ONLY the refined content. No explanations or preamble.`;
}
