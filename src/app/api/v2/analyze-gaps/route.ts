// ============================================
// ResumeOS V2: Gap Analysis Endpoint
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { GapAnalyzerAgent } from '@/lib/agents/gap-analyzer';
import type { JDStrategy, ContentSelectionResult } from '@/types/v2';

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const {
      strategy,
      selection,
    }: {
      strategy: JDStrategy;
      selection: ContentSelectionResult;
    } = await request.json();

    if (!strategy || !selection) {
      return NextResponse.json(
        { error: 'Both strategy and selection are required' },
        { status: 400 }
      );
    }

    if (!strategy.requirements || !strategy.positioning) {
      return NextResponse.json(
        { error: 'Strategy must include requirements and positioning' },
        { status: 400 }
      );
    }

    const agent = new GapAnalyzerAgent();
    const { output, diagnostics } = await agent.run({
      jdStrategy: strategy,
      sourceSelection: selection,
    });

    // Calculate summary stats
    const stats = {
      totalRequirements:
        strategy.requirements.mustHave.length +
        strategy.requirements.niceToHave.length,
      requirementsCovered: output.requirementCoverage.filter(
        (r) => r.coverage === 'fully_covered'
      ).length,
      requirementsPartial: output.requirementCoverage.filter(
        (r) => r.coverage === 'partially_covered'
      ).length,
      requirementsNotCovered: output.requirementCoverage.filter(
        (r) => r.coverage === 'not_covered'
      ).length,
      honestGaps: output.honestGaps.length,
      warnings: output.warnings.length,
      blockers: output.warnings.filter((w) => w.severity === 'blocker').length,
    };

    return NextResponse.json({
      success: true,
      gapAnalysis: output,
      stats,
      diagnostics: {
        inputTokens: diagnostics.inputTokens,
        outputTokens: diagnostics.outputTokens,
        cost: diagnostics.cost,
        durationMs: diagnostics.durationMs,
      },
    });
  } catch (error) {
    console.error('Gap Analyzer error:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Gap analysis failed',
      },
      { status: 500 }
    );
  }
}
