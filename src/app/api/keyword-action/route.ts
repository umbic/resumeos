import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { regenerateWithKeyword } from '@/lib/claude';
import type { JDAnalysis, JDKeyword, KeywordStatus } from '@/types';

interface KeywordActionRequest {
  sessionId: string;
  keywordId: string;
  action: 'add' | 'skip' | 'dismiss';
  userContext?: string;
  currentContent?: string;
  sectionType?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: KeywordActionRequest = await request.json();
    const { sessionId, keywordId, action, userContext, currentContent, sectionType } = body;

    if (!sessionId || !keywordId || !action) {
      return NextResponse.json(
        { error: 'sessionId, keywordId, and action are required' },
        { status: 400 }
      );
    }

    // Get current session
    const sessionResult = await sql`
      SELECT jd_analysis FROM sessions WHERE id = ${sessionId}
    `;

    if (sessionResult.rows.length === 0) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const jdAnalysis = sessionResult.rows[0].jd_analysis as JDAnalysis | null;

    if (!jdAnalysis) {
      return NextResponse.json(
        { error: 'No JD analysis found for this session' },
        { status: 400 }
      );
    }

    // Find the keyword
    const keyword = jdAnalysis.keywords.find((k) => k.id === keywordId);
    if (!keyword) {
      return NextResponse.json({ error: 'Keyword not found' }, { status: 404 });
    }

    let regeneratedContent: string | null = null;
    let newStatus: KeywordStatus;
    const metadata: Partial<JDKeyword> = {};

    switch (action) {
      case 'add':
        if (!userContext || !currentContent || !sectionType) {
          return NextResponse.json(
            { error: 'userContext, currentContent, and sectionType required for add action' },
            { status: 400 }
          );
        }

        // Regenerate content with the keyword included
        regeneratedContent = await regenerateWithKeyword(
          currentContent,
          keyword,
          userContext,
          jdAnalysis,
          sectionType
        );

        newStatus = 'addressed';
        metadata.sectionAddressed = sectionType;
        metadata.userContext = userContext;
        break;

      case 'skip':
        newStatus = 'skipped';
        break;

      case 'dismiss':
        newStatus = 'dismissed';
        metadata.dismissReason = 'User indicated they don\'t have this skill';
        break;

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    // Update the keyword status in the analysis
    const updatedKeywords = jdAnalysis.keywords.map((k) =>
      k.id === keywordId
        ? {
            ...k,
            status: newStatus,
            ...metadata,
          }
        : k
    );

    const updatedAnalysis: JDAnalysis = {
      ...jdAnalysis,
      keywords: updatedKeywords,
    };

    // Save updated analysis to database
    await sql`
      UPDATE sessions
      SET jd_analysis = ${JSON.stringify(updatedAnalysis)}, updated_at = NOW()
      WHERE id = ${sessionId}
    `;

    // Count remaining unaddressed keywords
    const remainingKeywords = updatedKeywords.filter(
      (k) => k.status === 'unaddressed' || k.status === 'skipped'
    ).length;

    return NextResponse.json({
      success: true,
      regeneratedContent,
      remainingKeywords,
      updatedKeyword: {
        id: keywordId,
        status: newStatus,
        ...metadata,
      },
    });
  } catch (error) {
    console.error('Error handling keyword action:', error);
    return NextResponse.json(
      { error: 'Failed to process keyword action' },
      { status: 500 }
    );
  }
}
