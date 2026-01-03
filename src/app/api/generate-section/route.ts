import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import {
  generateTailoredContent,
  generateSummary,
  refinePositionContent,
  detectAddressedKeywords,
  extractVerbsFromContent,
  ConversationMessage,
} from '@/lib/claude';
import { shouldUseGeneric, getContentVersion } from '@/lib/rules';
import type { JDAnalysis, JDKeyword, VerbTracker } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const { sessionId, sectionType, contentIds, instructions, currentContent, conversationHistory } = await request.json();

    if (!sessionId || !sectionType) {
      return NextResponse.json(
        { error: 'Session ID and section type are required' },
        { status: 400 }
      );
    }

    // Get session data including jd_analysis and verb_tracker
    const sessionResult = await sql`
      SELECT
        target_title,
        target_company,
        industry,
        keywords,
        themes,
        branding_mode,
        format,
        jd_analysis,
        verb_tracker
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

    // Extract verb tracker for action verb variety
    const verbTracker = (session.verb_tracker || { usedVerbs: {}, availableVerbs: [] }) as VerbTracker;
    const allUsedVerbs = Object.values(verbTracker.usedVerbs).flat();

    // Use enhanced jd_analysis if available, otherwise build from legacy fields
    let jdAnalysis: JDAnalysis;
    let unaddressedKeywords: JDKeyword[] = [];

    if (session.jd_analysis) {
      jdAnalysis = session.jd_analysis as JDAnalysis;
      unaddressedKeywords = jdAnalysis.keywords.filter(
        (k) => k.status === 'unaddressed' || k.status === 'skipped'
      );
    } else {
      // Legacy fallback - build JDAnalysis from flat fields
      jdAnalysis = {
        strategic: {
          targetTitle: session.target_title || '',
          targetCompany: session.target_company || '',
          industry: session.industry || '',
          positioningThemes: Array.isArray(session.themes) ? session.themes : [],
        },
        keywords: [],
      };
    }

    const brandingMode = session.branding_mode || 'branded';
    const format = session.format || 'long';

    // For summary generation, we don't need specific content IDs
    if (sectionType === 'summary') {
      // Get top matching summaries
      const summaryResult = await sql`
        SELECT
          id,
          content_long,
          content_generic,
          brand_tags
        FROM content_items
        WHERE type = 'summary'
          AND embedding IS NOT NULL
        ORDER BY embedding <=> (SELECT jd_embedding FROM sessions WHERE id = ${sessionId})
        LIMIT 5
      `;

      const summaryOptions = summaryResult.rows.map((row) => {
        const brandTags = Array.isArray(row.brand_tags) ? row.brand_tags : [];
        const useGeneric = brandingMode === 'generic' || shouldUseGeneric(brandTags, jdAnalysis.strategic.targetCompany);
        return useGeneric && row.content_generic ? row.content_generic : row.content_long;
      });

      const draft = await generateSummary(
        summaryOptions,
        jdAnalysis,
        format as 'long' | 'short',
        unaddressedKeywords,
        allUsedVerbs
      );

      // Detect which keywords were addressed in the generated content
      let missingKeywords: JDKeyword[] = [];
      let addressedKeywordIds: string[] = [];

      if (unaddressedKeywords.length > 0) {
        addressedKeywordIds = await detectAddressedKeywords(draft, unaddressedKeywords);
        missingKeywords = unaddressedKeywords.filter(
          (k) => !addressedKeywordIds.includes(k.id)
        );
      }

      // Extract verbs used in the generated content
      const detectedVerbs = extractVerbsFromContent(draft);

      return NextResponse.json({
        draft,
        contentUsed: summaryResult.rows.map((r) => r.id),
        missingKeywords,
        addressedKeywordIds,
        canApprove: missingKeywords.length === 0,
        detectedVerbs,
      });
    }

    // For position refinement
    if (sectionType === 'position' && currentContent && instructions) {
      // Filter conversation history to only include relevant messages (text only, no options)
      const filteredHistory: ConversationMessage[] = conversationHistory
        ? conversationHistory
            .filter((msg: { content: string; options?: unknown[] }) => msg.content && !msg.options)
            .map((msg: { role: string; content: string }) => ({
              role: msg.role as 'user' | 'assistant',
              content: msg.content,
            }))
        : [];

      const refined = await refinePositionContent(
        currentContent.overview,
        currentContent.bullets || [],
        instructions,
        jdAnalysis,
        filteredHistory,
        unaddressedKeywords,
        allUsedVerbs
      );

      // Detect which keywords were addressed in the refined content
      const combinedContent = `${refined.overview}\n${refined.bullets.join('\n')}`;
      let missingKeywords: JDKeyword[] = [];
      let addressedKeywordIds: string[] = [];

      if (unaddressedKeywords.length > 0) {
        addressedKeywordIds = await detectAddressedKeywords(combinedContent, unaddressedKeywords);
        missingKeywords = unaddressedKeywords.filter(
          (k) => !addressedKeywordIds.includes(k.id)
        );
      }

      // Extract verbs used in the refined content
      const detectedVerbs = extractVerbsFromContent(combinedContent);

      return NextResponse.json({
        draft: refined,
        missingKeywords,
        addressedKeywordIds,
        canApprove: missingKeywords.length === 0,
        detectedVerbs,
      });
    }

    // For other sections, get the specific content items
    if (!contentIds || contentIds.length === 0) {
      return NextResponse.json(
        { error: 'Content IDs are required for this section type' },
        { status: 400 }
      );
    }

    const contentIdList = contentIds.map((id: string) => `'${id}'`).join(',');
    const contentResult = await sql.query(`
      SELECT
        id,
        type,
        content_short,
        content_medium,
        content_long,
        content_generic,
        brand_tags
      FROM content_items
      WHERE id IN (${contentIdList})
    `);

    if (contentResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'No content found for provided IDs' },
        { status: 404 }
      );
    }

    // Determine version based on section type and format
    let version: 'short' | 'medium' | 'long' = 'long';
    if (sectionType === 'career_highlight') {
      version = format === 'long' ? 'medium' : 'short';
    }

    // Generate tailored content for each item
    const tailoredItems: string[] = [];

    for (const row of contentResult.rows) {
      const brandTags = Array.isArray(row.brand_tags) ? row.brand_tags : [];
      const useGeneric = brandingMode === 'generic' || shouldUseGeneric(brandTags, jdAnalysis.strategic.targetCompany);

      const originalContent = getContentVersion(
        {
          contentShort: row.content_short,
          contentMedium: row.content_medium,
          contentLong: row.content_long,
          contentGeneric: row.content_generic,
          brandTags,
        },
        version,
        useGeneric
      );

      const tailored = await generateTailoredContent(
        originalContent,
        jdAnalysis,
        sectionType,
        instructions,
        unaddressedKeywords,
        allUsedVerbs
      );

      tailoredItems.push(tailored);
    }

    // Format the draft based on section type
    let draft: string;
    if (sectionType === 'career_highlight') {
      draft = tailoredItems.map((item) => `• ${item}`).join('\n');
    } else if (sectionType === 'bullet') {
      draft = tailoredItems.map((item) => `• ${item}`).join('\n');
    } else {
      draft = tailoredItems.join('\n\n');
    }

    // Detect which keywords were addressed in the generated content
    let missingKeywords: JDKeyword[] = [];
    let addressedKeywordIds: string[] = [];

    if (unaddressedKeywords.length > 0) {
      addressedKeywordIds = await detectAddressedKeywords(draft, unaddressedKeywords);
      missingKeywords = unaddressedKeywords.filter(
        (k) => !addressedKeywordIds.includes(k.id)
      );
    }

    // Extract verbs used in the generated content
    const detectedVerbs = extractVerbsFromContent(draft);

    return NextResponse.json({
      draft,
      contentUsed: contentIds,
      missingKeywords,
      addressedKeywordIds,
      canApprove: missingKeywords.length === 0,
      detectedVerbs,
    });
  } catch (error) {
    console.error('Error generating section:', error);
    return NextResponse.json(
      { error: 'Failed to generate section' },
      { status: 500 }
    );
  }
}
