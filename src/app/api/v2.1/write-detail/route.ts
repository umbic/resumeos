import { NextRequest, NextResponse } from 'next/server';
import { NarrativeWriterAgent } from '@/lib/agents/narrative-writer';
import { DetailWriterAgent } from '@/lib/agents/detail-writer';
import { allocateContent } from '@/lib/pipeline/content-allocator';
import { db } from '@/lib/db';
import { sessions } from '@/drizzle/schema';
import { eq } from 'drizzle-orm';
import type { PipelineSession, ContentSelectionResult, SourceItem } from '@/types/v2';
import type { AllocatorInput, ContentCandidate, NarrativeWriterOutput } from '@/types/v2.1';

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
    const { sessionId, phase1Output } = await request.json();

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
        { error: 'Session missing JD strategy or content selection. Run analysis first.' },
        { status: 400 }
      );
    }

    // Convert V2 selection to V2.1 allocator input format
    const allocatorInput = adaptV2SelectionToAllocatorInput(v2Session.sourceSelection);

    // Allocate content
    const allocation = allocateContent(allocatorInput);

    let narrativeOutput: NarrativeWriterOutput = phase1Output;

    // If no phase1Output provided, run Phase 1 first
    if (!narrativeOutput) {
      console.log('No phase1Output provided, running Narrative Writer first...');
      const narrativeAgent = new NarrativeWriterAgent();
      const narrativeResult = await narrativeAgent.run({
        strategy: v2Session.jdStrategy,
        allocation
      });
      narrativeOutput = narrativeResult.output;
    }

    // Run detail writer (Phase 2)
    const detailAgent = new DetailWriterAgent();
    const result = await detailAgent.run({
      strategy: v2Session.jdStrategy,
      allocation,
      phase1Output: narrativeOutput
    });

    return NextResponse.json({
      success: true,
      phase1Summary: {
        usedVerbs: narrativeOutput.metadata.usedVerbs,
        thematicAnchors: narrativeOutput.metadata.thematicAnchors
      },
      output: result.output,
      diagnostics: {
        inputTokens: result.diagnostics.inputTokens,
        outputTokens: result.diagnostics.outputTokens,
        cost: result.diagnostics.cost,
        durationMs: result.diagnostics.durationMs
      }
    });

  } catch (error) {
    console.error('Detail writer error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Detail writer failed' },
      { status: 500 }
    );
  }
}
