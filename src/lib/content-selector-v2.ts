// ============================================
// ResumeOS V2: Multi-Source Content Selector
// ============================================
//
// This selector returns 2-3 candidates per slot, scored by tag overlap with JD signals.
// The writer (Agent 3) will later synthesize these into fresh content.

import masterContent from '@/data/master-content.json';
import type {
  JDStrategy,
  ContentSelectionResult,
  SourceItem,
  SlotSelection,
  ScoreBreakdown,
} from '@/types/v2';

// ============================================
// Types for internal use
// ============================================

interface ScoredItem {
  id: string;
  baseId: string;
  variantLabel?: string;
  content: string;
  industryScore: number;
  functionScore: number;
  themeScore: number;
  totalScore: number;
  matchedTags: {
    industry: string[];
    function: string[];
    theme: string[];
  };
}

interface ContentItem {
  id: string;
  title?: string;
  contentLong?: string;
  content?: string;
  industryTags?: string[];
  functionTags?: string[];
  themeTags?: string[];
  variants?: VariantItem[];
  position?: number;
  conflictsWith?: string[];
  exclusiveMetrics?: string[];
}

interface VariantItem {
  id: string;
  label?: string;
  content?: string;
  contentLong?: string;
  themeTags?: string[];
  industryTags?: string[];
  functionTags?: string[];
}

// ============================================
// Scoring Functions
// ============================================

/**
 * Score tag overlap between item tags and JD signals
 * Uses fuzzy matching for partial overlaps
 */
function scoreTagOverlap(
  itemTags: string[],
  signalTags: string[]
): { score: number; matched: string[] } {
  if (!itemTags || itemTags.length === 0) return { score: 0, matched: [] };

  const normalizedItem = itemTags.map(t => t.toLowerCase());
  const normalizedSignals = signalTags.map(t => t.toLowerCase());
  const matched: string[] = [];

  let score = 0;
  for (const signal of normalizedSignals) {
    // Direct match
    if (normalizedItem.includes(signal)) {
      score += 3;
      matched.push(signal);
    } else {
      // Partial match (signal contains item tag or vice versa)
      for (const itemTag of normalizedItem) {
        if (itemTag.includes(signal) || signal.includes(itemTag)) {
          score += 1;
          if (!matched.includes(itemTag)) matched.push(itemTag);
          break;
        }
      }
    }
  }

  return { score, matched };
}

/**
 * Score an item against JD strategy signals
 */
function scoreItem(
  id: string,
  baseId: string,
  content: string,
  industryTags: string[],
  functionTags: string[],
  themeTags: string[],
  signals: JDStrategy['scoringSignals'],
  variantLabel?: string
): ScoredItem {
  const industryResult = scoreTagOverlap(industryTags, signals.industries);
  const functionResult = scoreTagOverlap(functionTags, signals.functions);
  const themeResult = scoreTagOverlap(themeTags, signals.themes);

  // Weighted scoring: industry (1x), function (1x), theme (1x)
  const totalScore = industryResult.score + functionResult.score + themeResult.score;

  return {
    id,
    baseId,
    variantLabel,
    content,
    industryScore: industryResult.score,
    functionScore: functionResult.score,
    themeScore: themeResult.score,
    totalScore,
    matchedTags: {
      industry: industryResult.matched,
      function: functionResult.matched,
      theme: themeResult.matched,
    },
  };
}

/**
 * Select top N items from a scored list
 * Returns at least minItems, up to maxItems
 */
function selectTopN(
  items: ScoredItem[],
  maxItems: number,
  minItems: number = 1
): ScoredItem[] {
  const sorted = [...items].sort((a, b) => b.totalScore - a.totalScore);

  // Always return at least minItems
  if (sorted.length <= minItems) return sorted;

  // Return up to maxItems
  return sorted.slice(0, Math.max(minItems, Math.min(maxItems, sorted.length)));
}

/**
 * Convert ScoredItem to SourceItem for output
 */
function toSourceItem(item: ScoredItem): SourceItem {
  return {
    id: item.id,
    baseId: item.baseId,
    variantLabel: item.variantLabel,
    content: item.content,
    score: item.totalScore,
    tags: {
      industry: item.matchedTags.industry,
      function: item.matchedTags.function,
      theme: item.matchedTags.theme,
    },
  };
}

/**
 * Convert ScoredItem to ScoreBreakdown for debug output
 */
function toScoreBreakdown(item: ScoredItem): ScoreBreakdown {
  return {
    itemId: item.id,
    baseId: item.baseId !== item.id ? item.baseId : undefined,
    industryScore: item.industryScore,
    functionScore: item.functionScore,
    themeScore: item.themeScore,
    totalScore: item.totalScore,
    matchedTags: item.matchedTags,
  };
}

// ============================================
// Content Loading & Scoring
// ============================================

/**
 * Score all summaries and return top candidates
 */
function selectSummaries(
  signals: JDStrategy['scoringSignals']
): { selection: SlotSelection; scores: ScoreBreakdown[] } {
  const summaries = masterContent.summaries as ContentItem[];
  const scored: ScoredItem[] = [];

  for (const sum of summaries) {
    const item = scoreItem(
      sum.id,
      sum.id,
      sum.contentLong || '',
      sum.industryTags || [],
      sum.functionTags || [],
      sum.themeTags || [],
      signals
    );
    scored.push(item);
  }

  const selected = selectTopN(scored, 3, 2);

  return {
    selection: {
      slot: 'summary',
      sources: selected.map(toSourceItem),
      selectionRationale: `Selected ${selected.length} summaries based on industry/function/theme match. Top: ${selected[0]?.id} (score: ${selected[0]?.totalScore})`,
    },
    scores: scored.map(toScoreBreakdown),
  };
}

/**
 * Score career highlights and their variants
 * Returns 5 slots, each with 2-3 source candidates
 */
function selectCareerHighlights(
  signals: JDStrategy['scoringSignals'],
  blockedIds: Set<string>
): { selections: SlotSelection[]; scores: ScoreBreakdown[] } {
  const highlights = masterContent.careerHighlights as ContentItem[];
  const allScores: ScoreBreakdown[] = [];

  // Score all base items and their variants
  const baseScores: Map<string, ScoredItem[]> = new Map();

  for (const ch of highlights) {
    if (blockedIds.has(ch.id)) continue;

    // Score base item
    const baseItem = scoreItem(
      ch.id,
      ch.id,
      ch.contentLong || '',
      ch.industryTags || [],
      ch.functionTags || [],
      ch.themeTags || [],
      signals
    );

    const itemsForBase: ScoredItem[] = [baseItem];
    allScores.push(toScoreBreakdown(baseItem));

    // Score variants
    if (ch.variants && ch.variants.length > 0) {
      for (const v of ch.variants) {
        const variantItem = scoreItem(
          v.id,
          ch.id,
          v.content || v.contentLong || ch.contentLong || '',
          v.industryTags || ch.industryTags || [],
          v.functionTags || ch.functionTags || [],
          v.themeTags || [],
          signals,
          v.label
        );
        itemsForBase.push(variantItem);
        allScores.push(toScoreBreakdown(variantItem));
      }
    }

    baseScores.set(ch.id, itemsForBase);
  }

  // Sort bases by their best variant score
  const sortedBases = Array.from(baseScores.entries())
    .map(([baseId, items]) => ({
      baseId,
      items,
      bestScore: Math.max(...items.map(i => i.totalScore)),
    }))
    .sort((a, b) => b.bestScore - a.bestScore);

  // Select top 5 bases, each with up to 3 candidates
  const selections: SlotSelection[] = [];
  const selectedCount = Math.min(5, sortedBases.length);

  for (let i = 0; i < selectedCount; i++) {
    const { baseId, items } = sortedBases[i];
    const topItems = selectTopN(items, 3, 1);

    selections.push({
      slot: `ch_${i + 1}`,
      sources: topItems.map(toSourceItem),
      selectionRationale: `CH slot ${i + 1}: ${baseId} with ${topItems.length} variants. Best: ${topItems[0]?.id} (score: ${topItems[0]?.totalScore})`,
    });
  }

  return { selections, scores: allScores };
}

/**
 * Score position bullets and their variants
 */
function selectPositionBullets(
  position: 'P1' | 'P2',
  signals: JDStrategy['scoringSignals'],
  blockedIds: Set<string>,
  numSlots: number
): { selections: SlotSelection[]; scores: ScoreBreakdown[] } {
  const bullets = (masterContent.positionBullets as Record<string, ContentItem[]>)[position] || [];
  const allScores: ScoreBreakdown[] = [];

  const baseScores: Map<string, ScoredItem[]> = new Map();

  for (const bullet of bullets) {
    if (blockedIds.has(bullet.id)) continue;

    // Score base item
    const baseItem = scoreItem(
      bullet.id,
      bullet.id,
      bullet.contentLong || '',
      bullet.industryTags || [],
      bullet.functionTags || [],
      bullet.themeTags || [],
      signals
    );

    const itemsForBase: ScoredItem[] = [baseItem];
    allScores.push(toScoreBreakdown(baseItem));

    // Score variants
    if (bullet.variants && bullet.variants.length > 0) {
      for (const v of bullet.variants) {
        const variantItem = scoreItem(
          v.id,
          bullet.id,
          v.content || v.contentLong || bullet.contentLong || '',
          v.industryTags || bullet.industryTags || [],
          v.functionTags || bullet.functionTags || [],
          v.themeTags || [],
          signals,
          v.label
        );
        itemsForBase.push(variantItem);
        allScores.push(toScoreBreakdown(variantItem));
      }
    }

    baseScores.set(bullet.id, itemsForBase);
  }

  // Sort bases by best variant score
  const sortedBases = Array.from(baseScores.entries())
    .map(([baseId, items]) => ({
      baseId,
      items,
      bestScore: Math.max(...items.map(i => i.totalScore)),
    }))
    .sort((a, b) => b.bestScore - a.bestScore);

  // Select top N bases, each with up to 3 candidates
  const selections: SlotSelection[] = [];
  const selectedCount = Math.min(numSlots, sortedBases.length);

  for (let i = 0; i < selectedCount; i++) {
    const { baseId, items } = sortedBases[i];
    const topItems = selectTopN(items, 3, 1);

    selections.push({
      slot: `${position.toLowerCase()}_bullet_${i + 1}`,
      sources: topItems.map(toSourceItem),
      selectionRationale: `${position} bullet ${i + 1}: ${baseId} with ${topItems.length} variants. Best: ${topItems[0]?.id} (score: ${topItems[0]?.totalScore})`,
    });
  }

  return { selections, scores: allScores };
}

/**
 * Select overviews for each position
 * P1 and P2 have themed variants, P3-P6 use base content
 */
function selectOverviews(
  signals: JDStrategy['scoringSignals']
): { selections: { position: 3 | 4 | 5 | 6; overview: SlotSelection }[]; p1Overview: SlotSelection; p2Overview: SlotSelection; scores: ScoreBreakdown[] } {
  const overviews = masterContent.overviews as ContentItem[];
  const allScores: ScoreBreakdown[] = [];

  let p1Overview: SlotSelection | null = null;
  let p2Overview: SlotSelection | null = null;
  const positions3to6: { position: 3 | 4 | 5 | 6; overview: SlotSelection }[] = [];

  for (const ov of overviews) {
    const pos = ov.position || parseInt(ov.id.replace(/\D/g, '')) || 0;

    if (pos === 1 || pos === 2) {
      // Score variants for P1/P2
      const items: ScoredItem[] = [];

      // Score base
      const baseItem = scoreItem(
        ov.id,
        ov.id,
        ov.contentLong || '',
        ov.industryTags || [],
        ov.functionTags || [],
        ov.themeTags || [],
        signals
      );
      items.push(baseItem);
      allScores.push(toScoreBreakdown(baseItem));

      // Score variants
      if (ov.variants && ov.variants.length > 0) {
        for (const v of ov.variants) {
          const variantItem = scoreItem(
            v.id,
            ov.id,
            v.content || v.contentLong || ov.contentLong || '',
            v.industryTags || ov.industryTags || [],
            v.functionTags || ov.functionTags || [],
            v.themeTags || [],
            signals,
            v.label || v.id
          );
          items.push(variantItem);
          allScores.push(toScoreBreakdown(variantItem));
        }
      }

      const topItems = selectTopN(items, 2, 1);
      const selection: SlotSelection = {
        slot: `p${pos}_overview`,
        sources: topItems.map(toSourceItem),
        selectionRationale: `P${pos} overview: ${topItems.length} candidates. Best: ${topItems[0]?.id} (score: ${topItems[0]?.totalScore})`,
      };

      if (pos === 1) p1Overview = selection;
      if (pos === 2) p2Overview = selection;

    } else if (pos >= 3 && pos <= 6) {
      // P3-P6: Use base content only (no variants)
      const baseItem = scoreItem(
        ov.id,
        ov.id,
        ov.contentLong || '',
        ov.industryTags || [],
        ov.functionTags || [],
        [],
        signals
      );
      allScores.push(toScoreBreakdown(baseItem));

      positions3to6.push({
        position: pos as 3 | 4 | 5 | 6,
        overview: {
          slot: `p${pos}_overview`,
          sources: [toSourceItem(baseItem)],
          selectionRationale: `P${pos} overview: base content (no variants)`,
        },
      });
    }
  }

  return {
    p1Overview: p1Overview!,
    p2Overview: p2Overview!,
    selections: positions3to6,
    scores: allScores,
  };
}

// ============================================
// Main Selection Function
// ============================================

/**
 * Build conflict map from content
 */
function buildConflictMap(): Map<string, string[]> {
  const conflicts = new Map<string, string[]>();
  const rules = masterContent.conflictRules as { itemId: string; conflictsWith: string[] }[];

  for (const rule of rules) {
    conflicts.set(rule.itemId, rule.conflictsWith);
    // Also set reverse mapping
    for (const conflictId of rule.conflictsWith) {
      const existing = conflicts.get(conflictId) || [];
      if (!existing.includes(rule.itemId)) {
        conflicts.set(conflictId, [...existing, rule.itemId]);
      }
    }
  }

  return conflicts;
}

/**
 * Main V2 content selection function
 * Returns multiple source candidates per slot for the writer to synthesize
 */
export async function selectContentV2(
  strategy: JDStrategy
): Promise<ContentSelectionResult> {
  const signals = strategy.scoringSignals;
  const conflictMap = buildConflictMap();
  const allScores: ScoreBreakdown[] = [];
  const conflictsApplied: string[] = [];

  // 1. Select summaries
  const summaryResult = selectSummaries(signals);
  allScores.push(...summaryResult.scores);

  // 2. Select career highlights (before bullets to track conflicts)
  const blockedBySelection = new Set<string>();
  const chResult = selectCareerHighlights(signals, blockedBySelection);
  allScores.push(...chResult.scores);

  // Track which items were selected and block their conflicts
  for (const slot of chResult.selections) {
    for (const source of slot.sources) {
      const conflicts = conflictMap.get(source.baseId);
      if (conflicts) {
        for (const conflictId of conflicts) {
          blockedBySelection.add(conflictId);
          conflictsApplied.push(`${source.baseId} blocks ${conflictId}`);
        }
      }
    }
  }

  // 3. Select P1 bullets (4 slots, excluding conflicts)
  const p1Result = selectPositionBullets('P1', signals, blockedBySelection, 4);
  allScores.push(...p1Result.scores);

  // 4. Select P2 bullets (3 slots, excluding conflicts)
  const p2Result = selectPositionBullets('P2', signals, blockedBySelection, 3);
  allScores.push(...p2Result.scores);

  // 5. Select overviews
  const overviewResult = selectOverviews(signals);
  allScores.push(...overviewResult.scores);

  return {
    summary: summaryResult.selection,
    careerHighlights: chResult.selections,
    position1: {
      overview: overviewResult.p1Overview,
      bullets: p1Result.selections,
    },
    position2: {
      overview: overviewResult.p2Overview,
      bullets: p2Result.selections,
    },
    positions3to6: overviewResult.selections,
    debug: {
      jdSignals: signals,
      scoringBreakdown: allScores,
      conflictsApplied,
    },
  };
}
