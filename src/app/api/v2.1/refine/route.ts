// ============================================================
// ResumeOS V2.1: Section Refinement API Endpoint
// Handles AI-powered refinement of individual resume sections
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { db } from '@/lib/db';
import { sessions } from '@/drizzle/schema';
import { eq } from 'drizzle-orm';
import type { PipelineSession } from '@/types/v2';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Word count constraints
const WORD_LIMITS: Record<string, { min: number; max: number }> = {
  summary: { min: 140, max: 160 },
  'career-highlight': { min: 25, max: 40 },
  'position-overview': { min: 40, max: 60 },
  'position-bullet': { min: 25, max: 40 },
};

interface RefineRequest {
  sessionId: string;
  sectionType: 'summary' | 'career-highlight' | 'position-overview' | 'position-bullet';
  index?: number;
  positionIndex?: number;
  bulletIndex?: number;
  feedback?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: RefineRequest = await request.json();
    const { sessionId, sectionType, index, positionIndex, bulletIndex, feedback } = body;

    // Fetch session
    const [row] = await db.select().from(sessions).where(eq(sessions.id, sessionId));

    if (!row) {
      return NextResponse.json(
        { success: false, error: 'Session not found' },
        { status: 404 }
      );
    }

    const v2Session = row.v2Session as unknown as PipelineSession | null;

    if (!v2Session) {
      return NextResponse.json(
        { success: false, error: 'Not a V2.1 session' },
        { status: 400 }
      );
    }

    // Get current content and context
    const currentContent = getCurrentContent(v2Session, sectionType, index, positionIndex, bulletIndex);
    const sourceId = getSourceId(v2Session, sectionType, index, positionIndex, bulletIndex);
    const jdStrategy = (v2Session as unknown as { jdStrategy?: { company?: { name?: string }; role?: { title?: string } } }).jdStrategy;

    if (!currentContent) {
      return NextResponse.json(
        { success: false, error: 'Content not found' },
        { status: 404 }
      );
    }

    // Get word limits
    const limits = WORD_LIMITS[sectionType];

    // Build refinement prompt
    const prompt = buildRefinementPrompt({
      sectionType,
      currentContent,
      sourceId,
      feedback,
      limits,
      targetCompany: jdStrategy?.company?.name || 'Target Company',
      targetRole: jdStrategy?.role?.title || 'Target Role',
    });

    // Call Claude for refinement
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    });

    const responseContent = response.content[0];
    if (responseContent.type !== 'text') {
      throw new Error('Unexpected response type');
    }

    // Extract refined content
    let newContent = responseContent.text.trim();

    // Remove any markdown formatting
    newContent = newContent.replace(/^```[\w]*\n?/gm, '').replace(/```$/gm, '').trim();

    // Check word count
    const wordCount = newContent.split(/\s+/).filter(Boolean).length;

    return NextResponse.json({
      success: true,
      newContent,
      wordCount,
      isWithinLimits: wordCount >= limits.min && wordCount <= limits.max,
      limits,
    });
  } catch (error) {
    console.error('Error refining section:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to refine section' },
      { status: 500 }
    );
  }
}

function getCurrentContent(
  session: PipelineSession,
  sectionType: string,
  index?: number,
  positionIndex?: number,
  bulletIndex?: number
): string | null {
  // Access the session with proper typing
  const sessionData = session as unknown as {
    assembledResume?: {
      summary?: string;
      careerHighlights?: string[];
      positions?: Array<{
        overview?: string;
        bullets?: string[];
      }>;
    };
  };

  switch (sectionType) {
    case 'summary':
      return sessionData.assembledResume?.summary || null;

    case 'career-highlight':
      if (index !== undefined && sessionData.assembledResume?.careerHighlights) {
        return sessionData.assembledResume.careerHighlights[index] || null;
      }
      return null;

    case 'position-overview':
      if (positionIndex !== undefined && sessionData.assembledResume?.positions) {
        return sessionData.assembledResume.positions[positionIndex]?.overview || null;
      }
      return null;

    case 'position-bullet':
      if (
        positionIndex !== undefined &&
        bulletIndex !== undefined &&
        sessionData.assembledResume?.positions
      ) {
        return sessionData.assembledResume.positions[positionIndex]?.bullets?.[bulletIndex] || null;
      }
      return null;

    default:
      return null;
  }
}

function getSourceId(
  session: PipelineSession,
  sectionType: string,
  index?: number,
  positionIndex?: number,
  bulletIndex?: number
): string | undefined {
  // Access the session with proper typing
  const sessionData = session as unknown as {
    narrativeOutput?: {
      summary?: { sourcesUsed?: string[] };
      careerHighlights?: Array<{ sourceId?: string }>;
    };
    detailOutput?: {
      position1?: {
        overview?: { sourceId?: string };
        bullets?: Array<{ sourceId?: string }>;
      };
      position2?: {
        overview?: { sourceId?: string };
        bullets?: Array<{ sourceId?: string }>;
      };
    };
  };

  switch (sectionType) {
    case 'summary':
      return sessionData.narrativeOutput?.summary?.sourcesUsed?.join(', ');

    case 'career-highlight':
      if (index !== undefined && sessionData.narrativeOutput?.careerHighlights) {
        return sessionData.narrativeOutput.careerHighlights[index]?.sourceId;
      }
      return undefined;

    case 'position-overview':
      if (positionIndex !== undefined) {
        const posKey = positionIndex === 0 ? 'position1' : 'position2';
        return sessionData.detailOutput?.[posKey]?.overview?.sourceId;
      }
      return undefined;

    case 'position-bullet':
      if (positionIndex !== undefined && bulletIndex !== undefined) {
        const posKey = positionIndex === 0 ? 'position1' : 'position2';
        return sessionData.detailOutput?.[posKey]?.bullets?.[bulletIndex]?.sourceId;
      }
      return undefined;

    default:
      return undefined;
  }
}

function buildRefinementPrompt({
  sectionType,
  currentContent,
  sourceId,
  feedback,
  limits,
  targetCompany,
  targetRole,
}: {
  sectionType: string;
  currentContent: string;
  sourceId?: string;
  feedback?: string;
  limits: { min: number; max: number };
  targetCompany: string;
  targetRole: string;
}): string {
  const sectionLabel = {
    summary: 'Summary',
    'career-highlight': 'Career Highlight',
    'position-overview': 'Position Overview',
    'position-bullet': 'Position Bullet',
  }[sectionType];

  return `You are an expert executive resume writer refining a ${sectionLabel} for a senior brand strategist.

TARGET ROLE: ${targetRole}
TARGET COMPANY: ${targetCompany}

CURRENT CONTENT:
${currentContent}

${sourceId ? `SOURCE ID: ${sourceId}` : ''}

WORD COUNT REQUIREMENT: ${limits.min}-${limits.max} words

${feedback ? `USER FEEDBACK: ${feedback}` : 'TASK: Improve clarity, impact, and relevance while maintaining the same core facts and metrics.'}

CRITICAL RULES:
1. NEVER change any metrics, numbers, percentages, or dollar amounts
2. NEVER add industries, sectors, or capabilities not in the original
3. NEVER fabricate new achievements or outcomes
4. NEVER use emdashes (—) - use regular dashes (-) instead
5. Keep the same structure and key facts
6. Maintain a confident, executive tone

FORMATTING RULES:
- For career highlights: Use format "**Headline phrase**: supporting description with metrics."
- For bullets: Start with a strong action verb
- For overviews: Write in third person, past tense
- For summaries: Write in third person

Return ONLY the refined content, no explanations or metadata.`;
}
