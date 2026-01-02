import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { shouldUseGeneric, getContentVersion } from '@/lib/rules';

interface SearchResult {
  id: string;
  type: string;
  position: number | null;
  content: string;
  contentShort: string | null;
  contentMedium: string | null;
  contentLong: string | null;
  contentGeneric: string | null;
  brandTags: string[];
  categoryTags: string[];
  functionTags: string[];
  outcomeTags: string[];
  exclusiveMetrics: string[];
  similarity: number;
  canUse: boolean;
}

export async function POST(request: NextRequest) {
  try {
    const { sessionId, contentType, position, limit = 10 } = await request.json();

    if (!sessionId || !contentType) {
      return NextResponse.json(
        { error: 'Session ID and content type are required' },
        { status: 400 }
      );
    }

    // Get session data
    const sessionResult = await sql`
      SELECT
        jd_embedding,
        blocked_content_ids,
        target_company,
        branding_mode,
        format
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
    const blockedIds = (session.blocked_content_ids || []) as string[];
    const targetCompany = session.target_company || '';
    const brandingMode = session.branding_mode || 'branded';
    const format = session.format || 'long';

    // Build the query based on content type and position
    let query: string;
    const blockedList = blockedIds.length > 0
      ? blockedIds.map(id => `'${id}'`).join(',')
      : "''";

    if (position !== null && position !== undefined) {
      query = `
        SELECT
          id,
          type,
          position,
          content_short,
          content_medium,
          content_long,
          content_generic,
          brand_tags,
          category_tags,
          function_tags,
          outcome_tags,
          exclusive_metrics,
          1 - (embedding <=> (SELECT jd_embedding FROM sessions WHERE id = '${sessionId}')) as similarity
        FROM content_items
        WHERE type = '${contentType}'
          AND position = ${position}
          ${blockedIds.length > 0 ? `AND id NOT IN (${blockedList})` : ''}
          AND embedding IS NOT NULL
        ORDER BY embedding <=> (SELECT jd_embedding FROM sessions WHERE id = '${sessionId}')
        LIMIT ${limit}
      `;
    } else {
      query = `
        SELECT
          id,
          type,
          position,
          content_short,
          content_medium,
          content_long,
          content_generic,
          brand_tags,
          category_tags,
          function_tags,
          outcome_tags,
          exclusive_metrics,
          1 - (embedding <=> (SELECT jd_embedding FROM sessions WHERE id = '${sessionId}')) as similarity
        FROM content_items
        WHERE type = '${contentType}'
          ${blockedIds.length > 0 ? `AND id NOT IN (${blockedList})` : ''}
          AND embedding IS NOT NULL
        ORDER BY embedding <=> (SELECT jd_embedding FROM sessions WHERE id = '${sessionId}')
        LIMIT ${limit}
      `;
    }

    const contentResult = await sql.query(query);

    // Process results
    const results: SearchResult[] = contentResult.rows.map((row) => {
      const brandTags = Array.isArray(row.brand_tags) ? row.brand_tags : [];
      const useGeneric = brandingMode === 'generic' || shouldUseGeneric(brandTags, targetCompany);

      // Determine which version to use based on format and content type
      let version: 'short' | 'medium' | 'long' = 'long';
      if (contentType === 'career_highlight') {
        version = format === 'long' ? 'medium' : 'short';
      } else if (contentType === 'bullet') {
        version = 'long';
      }

      const content = getContentVersion(
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

      return {
        id: row.id,
        type: row.type,
        position: row.position,
        content,
        contentShort: row.content_short,
        contentMedium: row.content_medium,
        contentLong: row.content_long,
        contentGeneric: row.content_generic,
        brandTags,
        categoryTags: Array.isArray(row.category_tags) ? row.category_tags : [],
        functionTags: Array.isArray(row.function_tags) ? row.function_tags : [],
        outcomeTags: Array.isArray(row.outcome_tags) ? row.outcome_tags : [],
        exclusiveMetrics: Array.isArray(row.exclusive_metrics) ? row.exclusive_metrics : [],
        similarity: parseFloat(row.similarity) || 0,
        canUse: !blockedIds.includes(row.id),
      };
    });

    return NextResponse.json({ results });
  } catch (error) {
    console.error('Error searching content:', error);
    return NextResponse.json(
      { error: 'Failed to search content' },
      { status: 500 }
    );
  }
}
