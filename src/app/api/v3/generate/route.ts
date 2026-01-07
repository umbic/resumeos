// src/app/api/v3/generate/route.ts
// V3 Resume Generation API Endpoint

import { NextRequest, NextResponse } from 'next/server';
import { generateResumeV3 } from '@/lib/v3';

export const maxDuration = 300; // 5 minutes for Opus pipeline

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { jobDescription } = body;

    // Validation
    if (!jobDescription) {
      return NextResponse.json(
        { error: 'Job description is required' },
        { status: 400 }
      );
    }

    if (typeof jobDescription !== 'string') {
      return NextResponse.json(
        { error: 'Job description must be a string' },
        { status: 400 }
      );
    }

    if (jobDescription.length < 100) {
      return NextResponse.json(
        { error: 'Job description is too short (minimum 100 characters)' },
        { status: 400 }
      );
    }

    // Run V3 pipeline
    console.log('[V3] Starting generation...');
    const startTime = Date.now();

    const result = await generateResumeV3(jobDescription);

    const duration = Date.now() - startTime;
    console.log(`[V3] Generation complete in ${duration}ms`);

    if (!result.success) {
      console.error('[V3] Generation failed:', result.error);
      return NextResponse.json(
        {
          success: false,
          error: result.error || 'Generation failed',
          diagnostics: {
            sessionId: result.diagnostics.sessionId,
            errors: result.diagnostics.errors,
          },
        },
        { status: 500 }
      );
    }

    // Return successful result
    return NextResponse.json({
      success: true,
      resume: result.resume,
      coverageReport: result.coverageReport,
      diagnostics: {
        sessionId: result.diagnostics.sessionId,
        totalCost: result.diagnostics.totalCost,
        totalDurationMs: result.diagnostics.totalDurationMs,
        steps: result.diagnostics.steps.map((s) => ({
          step: s.step,
          status: s.status,
          durationMs: s.durationMs,
          retryCount: s.retryCount,
        })),
      },
    });
  } catch (error) {
    console.error('[V3] Unexpected error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unexpected error occurred',
      },
      { status: 500 }
    );
  }
}
