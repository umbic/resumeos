import { NextRequest, NextResponse } from 'next/server';
import { ValidatorAgentV21 } from '@/lib/agents/validator-v21';
import { allocateContent } from '@/lib/pipeline/content-allocator';
import { db } from '@/lib/db';
import { sessions } from '@/drizzle/schema';
import { eq } from 'drizzle-orm';
import type { PipelineSession, ContentSelectionResult, SourceItem } from '@/types/v2';
import type {
  AllocatorInput,
  ContentCandidate,
  NarrativeWriterOutput,
  DetailWriterOutput,
} from '@/types/v2.1';

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
        ...s.tags.theme,
      ],
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
        : [],
    },
  };
}

export async function POST(request: NextRequest) {
  try {
    const { sessionId, narrativeOutput, detailOutput } = await request.json();

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

    // Validate inputs
    if (!narrativeOutput || !detailOutput) {
      return NextResponse.json(
        { error: 'narrativeOutput and detailOutput are required. Run write-both first.' },
        { status: 400 }
      );
    }

    // Convert V2 selection to V2.1 allocator input format
    const allocatorInput = adaptV2SelectionToAllocatorInput(v2Session.sourceSelection);

    // Allocate content
    const allocation = allocateContent(allocatorInput);

    // Run validator
    console.log('=== VALIDATION ===');
    const validator = new ValidatorAgentV21();
    const result = await validator.run({
      strategy: v2Session.jdStrategy,
      allocation,
      narrativeOutput: narrativeOutput as NarrativeWriterOutput,
      detailOutput: detailOutput as DetailWriterOutput,
    });

    return NextResponse.json({
      success: true,
      validation: result.validation,
      diagnostics: {
        inputTokens: result.diagnostics.inputTokens,
        outputTokens: result.diagnostics.outputTokens,
        cost: result.diagnostics.cost,
        durationMs: result.diagnostics.durationMs,
      },
    });

  } catch (error) {
    console.error('Validation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Validation failed' },
      { status: 500 }
    );
  }
}
