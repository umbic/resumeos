// ============================================
// ResumeOS V2: JD Analysis Endpoint
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { JDStrategistAgent } from '@/lib/agents/jd-strategist';
import type { JDStrategistInput } from '@/types/v2';

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const body: JDStrategistInput = await request.json();

    if (!body.jobDescription || body.jobDescription.trim().length < 100) {
      return NextResponse.json(
        { error: 'Job description is required and must be at least 100 characters' },
        { status: 400 }
      );
    }

    const agent = new JDStrategistAgent();
    const { output, diagnostics } = await agent.run(body);

    return NextResponse.json({
      success: true,
      strategy: output,
      diagnostics: {
        inputTokens: diagnostics.inputTokens,
        outputTokens: diagnostics.outputTokens,
        cost: diagnostics.cost,
        durationMs: diagnostics.durationMs,
      },
    });
  } catch (error) {
    console.error('JD Strategist error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to analyze job description',
      },
      { status: 500 }
    );
  }
}
