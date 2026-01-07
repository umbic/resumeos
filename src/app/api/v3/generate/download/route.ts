// src/app/api/v3/generate/download/route.ts
// V3 Resume DOCX Download Endpoint

import { NextRequest, NextResponse } from 'next/server';
import { generateResumeV3, generateResumeDocx } from '@/lib/v3';

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

    // Run V3 pipeline
    console.log('[V3 Download] Starting generation...');
    const startTime = Date.now();

    const result = await generateResumeV3(jobDescription);

    if (!result.success || !result.resume) {
      console.error('[V3 Download] Generation failed:', result.error);
      return NextResponse.json(
        {
          success: false,
          error: result.error || 'Generation failed',
        },
        { status: 500 }
      );
    }

    const duration = Date.now() - startTime;
    console.log(`[V3 Download] Generation complete in ${duration}ms`);

    // Generate DOCX buffer
    const buffer = await generateResumeDocx(result.resume);

    // Create filename
    const timestamp = new Date().toISOString().split('T')[0];
    const company = result.resume.targetRole.company.replace(/[^a-zA-Z0-9]/g, '_');
    const filename = `Resume_${company}_${timestamp}.docx`;

    // Convert Buffer to Uint8Array for NextResponse
    const uint8Array = new Uint8Array(buffer);

    // Return DOCX file
    return new NextResponse(uint8Array, {
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'X-Session-Id': result.diagnostics.sessionId,
        'X-Total-Cost': result.diagnostics.totalCost.toFixed(4),
        'X-Duration-Ms': result.diagnostics.totalDurationMs.toString(),
      },
    });
  } catch (error) {
    console.error('[V3 Download] Unexpected error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unexpected error occurred',
      },
      { status: 500 }
    );
  }
}
