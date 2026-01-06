import {
  AllocatorInput,
  ContentAllocation,
  AllocatedSlot,
  AllocationLogEntry,
  ContentCandidate
} from '@/types/v2.1';

interface AllocationConfig {
  summaryCount: number;
  chCount: number;
  p1BulletCount: number;
  p2BulletCount: number;
}

const DEFAULT_CONFIG: AllocationConfig = {
  summaryCount: 2,
  chCount: 5,
  p1BulletCount: 4,
  p2BulletCount: 3
};

/**
 * Extract base ID from content ID (removes variant suffix)
 * CH-05-V2 → CH-05
 * P1-B08-V1 → P1-B08
 * CH-05 → CH-05 (no change if no variant)
 */
export function getBaseId(contentId: string): string {
  return contentId.replace(/-V\d+$/, '');
}

/**
 * Check if a content ID (or its base) has already been used
 */
function isAlreadyUsed(contentId: string, usedBaseIds: Set<string>): boolean {
  const baseId = getBaseId(contentId);
  return usedBaseIds.has(baseId);
}

/**
 * Allocate content exclusively to slots.
 *
 * Rules:
 * 1. Each base content ID can only be assigned to ONE slot
 * 2. If CH-05-V2 is assigned to ch-1, then CH-05-V1 and CH-05-V3 are blocked everywhere
 * 3. Summaries are a separate pool (SUM-* IDs don't conflict with CH-* or P1-*)
 * 4. Allocation order: Summaries → Career Highlights → P1 Bullets → P2 Bullets
 * 5. Higher priority slots get first pick of high-scoring content
 */
export function allocateContent(
  selection: AllocatorInput,
  config: AllocationConfig = DEFAULT_CONFIG
): ContentAllocation {
  const usedBaseIds = new Set<string>();
  const allocationLog: AllocationLogEntry[] = [];

  const allocation: ContentAllocation = {
    summaries: [],
    careerHighlights: [],
    position1Bullets: [],
    position2Bullets: [],
    position1Overview: null,
    position2Overview: null,
    allocationLog: []
  };

  // ─────────────────────────────────────────────────────────────
  // 1. ALLOCATE SUMMARIES
  // Summaries use SUM-* IDs, separate pool from bullets
  // ─────────────────────────────────────────────────────────────
  const summarySlots = Math.min(config.summaryCount, selection.summaries?.length || 0);
  for (let i = 0; i < summarySlots; i++) {
    const source = selection.summaries[i];
    if (source) {
      allocation.summaries.push({
        slot: `summary-source-${i + 1}`,
        contentId: source.id,
        content: source.content,
        score: source.score
      });
      allocationLog.push({
        action: 'assigned',
        slot: `summary-source-${i + 1}`,
        contentId: source.id,
        reason: `Summary source ${i + 1} (score: ${source.score})`
      });
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 2. ALLOCATE CAREER HIGHLIGHTS (Highest Priority)
  // ─────────────────────────────────────────────────────────────
  for (let i = 0; i < config.chCount; i++) {
    const candidates = selection.careerHighlights?.[i] || [];
    const available = candidates.filter((c: ContentCandidate) => !isAlreadyUsed(c.id, usedBaseIds));

    if (available.length > 0) {
      // Pick highest scored available candidate
      const selected = available[0];
      const baseId = getBaseId(selected.id);

      allocation.careerHighlights.push({
        slot: `ch-${i + 1}`,
        contentId: selected.id,
        content: selected.content,
        score: selected.score
      });

      usedBaseIds.add(baseId);

      const blocked = candidates
        .filter((c: ContentCandidate) => c.id !== selected.id)
        .map((c: ContentCandidate) => c.id);

      allocationLog.push({
        action: 'assigned',
        slot: `ch-${i + 1}`,
        contentId: selected.id,
        reason: `Best available (score: ${selected.score})`,
        blockedVariants: blocked.length > 0 ? blocked : undefined
      });
    } else {
      allocationLog.push({
        action: 'skipped',
        slot: `ch-${i + 1}`,
        contentId: null,
        reason: candidates.length > 0
          ? 'All candidates already used in earlier slots'
          : 'No candidates available'
      });
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 3. ALLOCATE POSITION 1 BULLETS
  // Cannot use anything already used in Career Highlights
  // ─────────────────────────────────────────────────────────────
  for (let i = 0; i < config.p1BulletCount; i++) {
    const candidates = selection.position1Bullets?.[i] || [];
    const available = candidates.filter((c: ContentCandidate) => !isAlreadyUsed(c.id, usedBaseIds));

    if (available.length > 0) {
      const selected = available[0];
      const baseId = getBaseId(selected.id);

      allocation.position1Bullets.push({
        slot: `p1-bullet-${i + 1}`,
        contentId: selected.id,
        content: selected.content,
        score: selected.score
      });

      usedBaseIds.add(baseId);

      allocationLog.push({
        action: 'assigned',
        slot: `p1-bullet-${i + 1}`,
        contentId: selected.id,
        reason: `Best available after CH allocation (score: ${selected.score})`
      });
    } else {
      allocationLog.push({
        action: 'skipped',
        slot: `p1-bullet-${i + 1}`,
        contentId: null,
        reason: candidates.length > 0
          ? 'All candidates already used'
          : 'No candidates available'
      });
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 4. ALLOCATE POSITION 2 BULLETS
  // Cannot use anything already used in CH or P1
  // ─────────────────────────────────────────────────────────────
  for (let i = 0; i < config.p2BulletCount; i++) {
    const candidates = selection.position2Bullets?.[i] || [];
    const available = candidates.filter((c: ContentCandidate) => !isAlreadyUsed(c.id, usedBaseIds));

    if (available.length > 0) {
      const selected = available[0];
      const baseId = getBaseId(selected.id);

      allocation.position2Bullets.push({
        slot: `p2-bullet-${i + 1}`,
        contentId: selected.id,
        content: selected.content,
        score: selected.score
      });

      usedBaseIds.add(baseId);

      allocationLog.push({
        action: 'assigned',
        slot: `p2-bullet-${i + 1}`,
        contentId: selected.id,
        reason: `Best available after CH+P1 allocation (score: ${selected.score})`
      });
    } else {
      allocationLog.push({
        action: 'skipped',
        slot: `p2-bullet-${i + 1}`,
        contentId: null,
        reason: candidates.length > 0
          ? 'All candidates already used'
          : 'No candidates available'
      });
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 5. ALLOCATE OVERVIEWS
  // Overviews don't conflict with bullets (different content type)
  // ─────────────────────────────────────────────────────────────
  const p1Overviews = selection.overviews?.[1] || selection.overviews?.['1' as unknown as number] || [];
  if (p1Overviews.length > 0) {
    allocation.position1Overview = {
      slot: 'p1-overview',
      contentId: p1Overviews[0].id,
      content: p1Overviews[0].content,
      score: p1Overviews[0].score || 0
    };
    allocationLog.push({
      action: 'assigned',
      slot: 'p1-overview',
      contentId: p1Overviews[0].id,
      reason: 'Position 1 overview'
    });
  }

  const p2Overviews = selection.overviews?.[2] || selection.overviews?.['2' as unknown as number] || [];
  if (p2Overviews.length > 0) {
    allocation.position2Overview = {
      slot: 'p2-overview',
      contentId: p2Overviews[0].id,
      content: p2Overviews[0].content,
      score: p2Overviews[0].score || 0
    };
    allocationLog.push({
      action: 'assigned',
      slot: 'p2-overview',
      contentId: p2Overviews[0].id,
      reason: 'Position 2 overview'
    });
  }

  allocation.allocationLog = allocationLog;

  return allocation;
}

/**
 * Get allocation summary for diagnostics
 */
export function getAllocationSummary(allocation: ContentAllocation): {
  totalSlots: number;
  assignedSlots: number;
  skippedSlots: number;
  uniqueBaseIds: number;
} {
  const assigned = allocation.allocationLog.filter(e => e.action === 'assigned').length;
  const skipped = allocation.allocationLog.filter(e => e.action === 'skipped').length;

  const baseIds = new Set<string>();
  [
    ...allocation.careerHighlights,
    ...allocation.position1Bullets,
    ...allocation.position2Bullets
  ].forEach((slot: AllocatedSlot) => {
    baseIds.add(getBaseId(slot.contentId));
  });

  return {
    totalSlots: assigned + skipped,
    assignedSlots: assigned,
    skippedSlots: skipped,
    uniqueBaseIds: baseIds.size
  };
}

/**
 * Verify that no content ID (or its base) appears in multiple slots
 * Returns true if allocation is valid (no duplicates)
 */
export function verifyNoDuplicates(allocation: ContentAllocation): {
  valid: boolean;
  duplicates: { baseId: string; slots: string[] }[];
} {
  const baseIdToSlots = new Map<string, string[]>();

  // Collect all slot assignments
  const allSlots = [
    ...allocation.careerHighlights,
    ...allocation.position1Bullets,
    ...allocation.position2Bullets
  ];

  if (allocation.position1Overview) {
    allSlots.push(allocation.position1Overview);
  }
  if (allocation.position2Overview) {
    allSlots.push(allocation.position2Overview);
  }

  // Group by base ID
  for (const slot of allSlots) {
    const baseId = getBaseId(slot.contentId);
    const existing = baseIdToSlots.get(baseId) || [];
    existing.push(slot.slot);
    baseIdToSlots.set(baseId, existing);
  }

  // Find duplicates
  const duplicates: { baseId: string; slots: string[] }[] = [];
  baseIdToSlots.forEach((slots, baseId) => {
    if (slots.length > 1) {
      duplicates.push({ baseId, slots });
    }
  });

  return {
    valid: duplicates.length === 0,
    duplicates
  };
}
