import { NextRequest, NextResponse } from 'next/server';
import { NarrativeWriterAgent } from '@/lib/agents/narrative-writer';
import { DetailWriterAgent } from '@/lib/agents/detail-writer';
import { allocateContent } from '@/lib/pipeline/content-allocator';
import { db } from '@/lib/db';
import { sessions } from '@/drizzle/schema';
import { eq } from 'drizzle-orm';
import type { PipelineSession, ContentSelectionResult, SourceItem } from '@/types/v2';
import type { AllocatorInput, ContentCandidate } from '@/types/v2.1';

export const maxDuration = 180;

/**
 * Convert V2 ContentSelectionResult to V2.1 AllocatorInput format
 */
function adaptV2SelectionToAllocatorInput(selection: ContentSelectionResult): AllocatorInput {
  const convertSources = (sources: SourceItem[]): ContentCandidate[] => {
    return sources.map(s => ({
      id: s.id,
      content: s.content,
      score: s.score,
      matchedTags: [
        ...s.tags.industry,
        ...s.tags.function,
        ...s.tags.theme
      ]
    }));
  };

  return {
    summaries: selection.summary?.sources
      ? convertSources(selection.summary.sources)
      : [],
    careerHighlights: selection.careerHighlights?.map(slot =>
      convertSources(slot.sources)
    ) || [],
    position1Bullets: selection.position1?.bullets?.map(slot =>
      convertSources(slot.sources)
    ) || [],
    position2Bullets: selection.position2?.bullets?.map(slot =>
      convertSources(slot.sources)
    ) || [],
    overviews: {
      1: selection.position1?.overview?.sources
        ? convertSources(selection.position1.overview.sources)
        : [],
      2: selection.position2?.overview?.sources
        ? convertSources(selection.position2.overview.sources)
        : []
    }
  };
}

export async function POST(request: NextRequest) {
  try {
    const { sessionId } = await request.json();

    if (!sessionId) {
      return NextResponse.json(
        { error: 'sessionId is required' },
        { status: 400 }
      );
    }

    // Load session
    const [row] = await db
      .select()
      .from(sessions)
      .where(eq(sessions.id, sessionId));

    if (!row) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    const v2Session = row.v2Session as PipelineSession | null;

    if (!v2Session) {
      return NextResponse.json(
        { error: 'No V2 session data found' },
        { status: 400 }
      );
    }

    if (!v2Session.jdStrategy || !v2Session.sourceSelection) {
      return NextResponse.json(
        { error: 'Session missing JD strategy or content selection' },
        { status: 400 }
      );
    }

    // Convert V2 selection to V2.1 allocator input format
    const allocatorInput = adaptV2SelectionToAllocatorInput(v2Session.sourceSelection);

    // Allocate content
    const allocation = allocateContent(allocatorInput);

    // Phase 1: Narrative Writer
    console.log('=== PHASE 1: Narrative Writer ===');
    const narrativeAgent = new NarrativeWriterAgent();
    const narrativeResult = await narrativeAgent.run({
      strategy: v2Session.jdStrategy,
      allocation
    });

    // Phase 2: Detail Writer
    console.log('=== PHASE 2: Detail Writer ===');
    const detailAgent = new DetailWriterAgent();
    const detailResult = await detailAgent.run({
      strategy: v2Session.jdStrategy,
      allocation,
      phase1Output: narrativeResult.output
    });

    // Combine all verbs used
    const allVerbs = [
      ...narrativeResult.output.metadata.usedVerbs,
      ...detailResult.output.metadata.usedVerbs
    ];
    const uniqueVerbs = Array.from(new Set(allVerbs));

    // Check for any verb used more than twice
    const verbCounts: Record<string, number> = {};
    allVerbs.forEach(v => {
      const lower = v.toLowerCase();
      verbCounts[lower] = (verbCounts[lower] || 0) + 1;
    });
    const overusedVerbs = Object.entries(verbCounts)
      .filter(([, count]) => count > 2)
      .map(([verb, count]) => ({ verb, count }));

    return NextResponse.json({
      success: true,
      allocation: {
        summaries: allocation.summaries.length,
        careerHighlights: allocation.careerHighlights.length,
        p1Bullets: allocation.position1Bullets.length,
        p2Bullets: allocation.position2Bullets.length
      },
      phase1: {
        summary: narrativeResult.output.summary,
        careerHighlights: narrativeResult.output.careerHighlights,
        usedVerbs: narrativeResult.output.metadata.usedVerbs,
        thematicAnchors: narrativeResult.output.metadata.thematicAnchors,
        cost: narrativeResult.diagnostics.cost,
        durationMs: narrativeResult.diagnostics.durationMs
      },
      phase2: {
        position1: detailResult.output.position1,
        position2: detailResult.output.position2,
        usedVerbs: detailResult.output.metadata.usedVerbs,
        cost: detailResult.diagnostics.cost,
        durationMs: detailResult.diagnostics.durationMs
      },
      verbAnalysis: {
        totalVerbs: allVerbs.length,
        uniqueVerbs: uniqueVerbs.length,
        overusedVerbs
      },
      totalCost: narrativeResult.diagnostics.cost + detailResult.diagnostics.cost,
      totalDurationMs: narrativeResult.diagnostics.durationMs + detailResult.diagnostics.durationMs
    });

  } catch (error) {
    console.error('Write both error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Writing failed' },
      { status: 500 }
    );
  }
}
