// ============================================
// ResumeOS V2: Content Selection Endpoint
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { selectContentV2 } from '@/lib/content-selector-v2';
import type { JDStrategy } from '@/types/v2';

export async function POST(request: NextRequest) {
  try {
    const { strategy }: { strategy: JDStrategy } = await request.json();

    if (!strategy || !strategy.scoringSignals) {
      return NextResponse.json(
        { error: 'Valid JDStrategy with scoringSignals is required' },
        { status: 400 }
      );
    }

    const selection = await selectContentV2(strategy);

    // Calculate stats
    const stats = {
      summariesSelected: selection.summary.sources.length,
      highlightSlots: selection.careerHighlights.length,
      highlightCandidates: selection.careerHighlights.reduce(
        (sum, slot) => sum + slot.sources.length,
        0
      ),
      p1BulletSlots: selection.position1.bullets.length,
      p1BulletCandidates: selection.position1.bullets.reduce(
        (sum, slot) => sum + slot.sources.length,
        0
      ),
      p2BulletSlots: selection.position2.bullets.length,
      p2BulletCandidates: selection.position2.bullets.reduce(
        (sum, slot) => sum + slot.sources.length,
        0
      ),
      overviewPositions: selection.positions3to6.length + 2, // +2 for P1 and P2
      conflictsApplied: selection.debug.conflictsApplied.length,
    };

    return NextResponse.json({
      success: true,
      selection,
      stats,
    });
  } catch (error) {
    console.error('Content selection error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Content selection failed',
      },
      { status: 500 }
    );
  }
}
