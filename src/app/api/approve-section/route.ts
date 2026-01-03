import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { getAllConflicts } from '@/lib/rules';
import { extractVerbsFromContent } from '@/lib/claude';
import type { VerbTracker } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const { sessionId, sectionType, content, contentIds, positionData } = await request.json();

    if (!sessionId || !sectionType) {
      return NextResponse.json(
        { error: 'Session ID and section type are required' },
        { status: 400 }
      );
    }

    // Get current session state
    const sessionResult = await sql`
      SELECT
        used_content_ids,
        blocked_content_ids,
        current_step,
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
    const currentUsedIds = (session.used_content_ids || []) as string[];
    const currentBlockedIds = (session.blocked_content_ids || []) as string[];
    const currentStep = session.current_step || 0;

    // Extract verbs from approved content and update verb tracker
    const currentTracker = (session.verb_tracker || { usedVerbs: {}, availableVerbs: [] }) as VerbTracker;

    // Determine content to extract verbs from
    let contentToExtract = '';
    if (typeof content === 'string') {
      contentToExtract = content;
    } else if (content && typeof content === 'object') {
      // For position content with overview and bullets
      if (content.overview) {
        contentToExtract = content.overview;
      }
      if (content.bullets && Array.isArray(content.bullets)) {
        contentToExtract += '\n' + content.bullets.join('\n');
      }
    }

    // Extract verbs and update tracker (only for content sections)
    if (contentToExtract && sectionType !== 'format' && sectionType !== 'header') {
      const detectedVerbs = extractVerbsFromContent(contentToExtract);
      const sectionKey = sectionType === 'position'
        ? `position_${positionData?.number || positionData?.position}`
        : sectionType;

      currentTracker.usedVerbs[sectionKey] = detectedVerbs;

      // Remove used verbs from available
      currentTracker.availableVerbs = currentTracker.availableVerbs.filter(
        (v: string) => !detectedVerbs.includes(v)
      );
    }

    // Calculate new conflicts if content IDs are provided
    let newBlockedIds: string[] = [];
    if (contentIds && contentIds.length > 0) {
      newBlockedIds = getAllConflicts(contentIds);
    }

    // Merge with existing
    const updatedUsedIds = Array.from(new Set([...currentUsedIds, ...(contentIds || [])]));
    const updatedBlockedIds = Array.from(new Set([...currentBlockedIds, ...newBlockedIds]));

    // Update based on section type
    switch (sectionType) {
      case 'format':
        await sql`
          UPDATE sessions
          SET format = ${content},
              current_step = ${currentStep + 1},
              updated_at = NOW()
          WHERE id = ${sessionId}
        `;
        break;

      case 'header':
        await sql`
          UPDATE sessions
          SET approved_header = ${JSON.stringify(content)},
              current_step = ${currentStep + 1},
              updated_at = NOW()
          WHERE id = ${sessionId}
        `;
        break;

      case 'summary':
        await sql`
          UPDATE sessions
          SET approved_summary = ${content},
              used_content_ids = ${JSON.stringify(updatedUsedIds)},
              blocked_content_ids = ${JSON.stringify(updatedBlockedIds)},
              verb_tracker = ${JSON.stringify(currentTracker)},
              current_step = ${currentStep + 1},
              updated_at = NOW()
          WHERE id = ${sessionId}
        `;
        break;

      case 'career_highlight':
      case 'highlights':
        await sql`
          UPDATE sessions
          SET approved_highlights = ${JSON.stringify(contentIds || [])},
              used_content_ids = ${JSON.stringify(updatedUsedIds)},
              blocked_content_ids = ${JSON.stringify(updatedBlockedIds)},
              verb_tracker = ${JSON.stringify(currentTracker)},
              current_step = ${currentStep + 1},
              updated_at = NOW()
          WHERE id = ${sessionId}
        `;
        break;

      case 'position':
        // Get current approved positions
        const posResult = await sql`
          SELECT approved_positions FROM sessions WHERE id = ${sessionId}
        `;
        const currentPositions = posResult.rows[0]?.approved_positions || {};

        // Update with new position data
        const updatedPositions = {
          ...currentPositions,
          [positionData.number]: {
            title: positionData.title,
            company: positionData.company,
            location: positionData.location,
            dates: positionData.dates,
            overview: content,
            bullets: positionData.bullets || [],
          },
        };

        await sql`
          UPDATE sessions
          SET approved_positions = ${JSON.stringify(updatedPositions)},
              used_content_ids = ${JSON.stringify(updatedUsedIds)},
              blocked_content_ids = ${JSON.stringify(updatedBlockedIds)},
              verb_tracker = ${JSON.stringify(currentTracker)},
              current_step = ${currentStep + 1},
              updated_at = NOW()
          WHERE id = ${sessionId}
        `;
        break;

      default:
        return NextResponse.json(
          { error: 'Invalid section type' },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      nextStep: currentStep + 1,
      blockedContentIds: updatedBlockedIds,
    });
  } catch (error) {
    console.error('Error approving section:', error);
    return NextResponse.json(
      { error: 'Failed to approve section' },
      { status: 500 }
    );
  }
}
