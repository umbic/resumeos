// ============================================================
// ResumeOS V2.1: Selection to Allocator Transformer
// ============================================================
//
// Transforms ContentSelectionResult (from selectContentV2)
// into AllocatorInput (for allocateContent)

import type { ContentSelectionResult, SourceItem } from '@/types/v2';
import type { AllocatorInput, ContentCandidate } from '@/types/v2.1';

/**
 * Convert a SourceItem to a ContentCandidate
 */
function toContentCandidate(source: SourceItem): ContentCandidate {
  return {
    id: source.id,
    content: source.content,
    score: source.score,
    matchedTags: [
      ...source.tags.industry,
      ...source.tags.function,
      ...source.tags.theme,
    ],
  };
}

/**
 * Transform ContentSelectionResult into AllocatorInput format
 *
 * ContentSelectionResult has:
 * - summary: SlotSelection (single slot with multiple sources)
 * - careerHighlights: SlotSelection[] (5 slots)
 * - position1.bullets: SlotSelection[] (4 slots)
 * - position2.bullets: SlotSelection[] (3 slots)
 * - position1.overview: SlotSelection
 * - position2.overview: SlotSelection
 *
 * AllocatorInput expects:
 * - summaries: ContentCandidate[]
 * - careerHighlights: ContentCandidate[][] (5 slots, each with ranked candidates)
 * - position1Bullets: ContentCandidate[][] (4 slots)
 * - position2Bullets: ContentCandidate[][] (3 slots)
 * - overviews: { [position]: ContentCandidate[] }
 */
export function transformSelectionToAllocatorInput(
  selection: ContentSelectionResult
): AllocatorInput {
  return {
    // Summaries: single slot with candidates
    summaries: selection.summary.sources.map(toContentCandidate),

    // Career Highlights: array of slots, each with array of candidates
    careerHighlights: selection.careerHighlights.map((slot) =>
      slot.sources.map(toContentCandidate)
    ),

    // Position 1 Bullets: array of slots
    position1Bullets: selection.position1.bullets.map((slot) =>
      slot.sources.map(toContentCandidate)
    ),

    // Position 2 Bullets: array of slots
    position2Bullets: selection.position2.bullets.map((slot) =>
      slot.sources.map(toContentCandidate)
    ),

    // Overviews: keyed by position number
    overviews: {
      1: selection.position1.overview.sources.map(toContentCandidate),
      2: selection.position2.overview.sources.map(toContentCandidate),
      // P3-P6 overviews come from profile, not content selection
    },
  };
}
