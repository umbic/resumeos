import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { Packer } from 'docx';
import { generateResumeDocument } from '@/lib/docx-export';
import { STATIC_CONTENT, POSITIONS, getContentVersion, shouldUseGeneric } from '@/lib/rules';

export async function POST(request: NextRequest) {
  try {
    const { sessionId } = await request.json();

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      );
    }

    // Get session data
    const sessionResult = await sql`
      SELECT
        target_title,
        target_company,
        approved_header,
        approved_summary,
        approved_highlights,
        approved_positions,
        format,
        branding_mode
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
    const format = (session.format || 'long') as 'long' | 'short';
    const brandingMode = session.branding_mode || 'branded';
    const targetCompany = session.target_company || '';

    // Get approved highlights content
    const highlightIds = (session.approved_highlights || []) as string[];
    let highlights: string[] = [];

    if (highlightIds.length > 0) {
      const highlightIdList = highlightIds.map(id => `'${id}'`).join(',');
      const highlightResult = await sql.query(`
        SELECT
          id,
          content_short,
          content_medium,
          content_long,
          content_generic,
          brand_tags
        FROM content_items
        WHERE id IN (${highlightIdList})
      `);

      // Maintain order of highlightIds
      const highlightMap = new Map(highlightResult.rows.map(r => [r.id, r]));
      const version = format === 'long' ? 'medium' : 'short';

      highlights = highlightIds.map(id => {
        const item = highlightMap.get(id);
        if (!item) return '';

        const brandTags = Array.isArray(item.brand_tags) ? item.brand_tags : [];
        const useGeneric = brandingMode === 'generic' || shouldUseGeneric(brandTags, targetCompany);

        return getContentVersion(
          {
            contentShort: item.content_short,
            contentMedium: item.content_medium,
            contentLong: item.content_long,
            contentGeneric: item.content_generic,
            brandTags,
          },
          version as 'short' | 'medium' | 'long',
          useGeneric
        );
      }).filter(Boolean);
    }

    // Build positions data
    const approvedPositions = (session.approved_positions || {}) as {
      [key: number]: {
        title: string;
        company: string;
        location: string;
        dates: string;
        overview: string;
        bullets: string[];
      };
    };

    // Merge with default position data
    const positions: { [key: number]: {
      title: string;
      company: string;
      location: string;
      dates: string;
      overview: string;
      bullets: string[];
    }} = {};

    for (const posConfig of POSITIONS) {
      const approved = approvedPositions[posConfig.number];
      positions[posConfig.number] = {
        title: approved?.title || posConfig.titleDefault,
        company: approved?.company || posConfig.company,
        location: approved?.location || posConfig.location,
        dates: approved?.dates || posConfig.dates,
        overview: approved?.overview || '',
        bullets: approved?.bullets || [],
      };
    }

    // Build header
    const approvedHeader = session.approved_header as {
      name?: string;
      title?: string;
      location?: string;
      phone?: string;
      email?: string;
    } | null;

    const header = {
      name: approvedHeader?.name || STATIC_CONTENT.header.name,
      title: approvedHeader?.title || session.target_title || 'Brand Strategist',
      location: approvedHeader?.location || STATIC_CONTENT.header.location,
      phone: approvedHeader?.phone || STATIC_CONTENT.header.phone,
      email: approvedHeader?.email || STATIC_CONTENT.header.email,
    };

    // Generate document
    const doc = generateResumeDocument({
      header,
      summary: session.approved_summary || '',
      highlights,
      positions,
      education: STATIC_CONTENT.education,
      format,
    });

    // Generate buffer
    const buffer = await Packer.toBuffer(doc);

    // Return as downloadable file
    const filename = `${header.name.replace(/\s+/g, '_')}_Resume_${new Date().toISOString().split('T')[0]}.docx`;

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('Error exporting DOCX:', error);
    return NextResponse.json(
      { error: 'Failed to export document' },
      { status: 500 }
    );
  }
}
