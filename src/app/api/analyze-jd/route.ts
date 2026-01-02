import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { analyzeJobDescription } from '@/lib/claude';
import { generateEmbedding } from '@/lib/openai';
import { COMPETITOR_MAP } from '@/lib/rules';

export async function POST(request: NextRequest) {
  try {
    const { jobDescription } = await request.json();

    if (!jobDescription) {
      return NextResponse.json(
        { error: 'Job description is required' },
        { status: 400 }
      );
    }

    // Analyze JD with Claude
    const analysis = await analyzeJobDescription(jobDescription);

    // Generate embedding for the JD
    const jdEmbedding = await generateEmbedding(jobDescription);
    const embeddingStr = `[${jdEmbedding.join(',')}]`;

    // Determine branding mode based on target company
    let recommendedBrandingMode = analysis.recommendedBrandingMode || 'branded';
    const competitorBrands = COMPETITOR_MAP[analysis.targetCompany] || [];
    if (competitorBrands.length > 0) {
      recommendedBrandingMode = 'generic';
    }

    // Create new session
    const result = await sql`
      INSERT INTO sessions (
        job_description,
        target_title,
        target_company,
        industry,
        keywords,
        themes,
        jd_embedding,
        branding_mode
      ) VALUES (
        ${jobDescription},
        ${analysis.targetTitle},
        ${analysis.targetCompany},
        ${analysis.industry},
        ${JSON.stringify(analysis.keywords)},
        ${JSON.stringify(analysis.themes)},
        ${embeddingStr}::vector,
        ${recommendedBrandingMode}
      )
      RETURNING id
    `;

    const sessionId = result.rows[0].id;

    return NextResponse.json({
      sessionId,
      analysis: {
        targetTitle: analysis.targetTitle,
        targetCompany: analysis.targetCompany,
        industry: analysis.industry,
        keywords: analysis.keywords,
        themes: analysis.themes,
        recommendedBrandingMode,
        reasoning: analysis.reasoning,
      },
    });
  } catch (error) {
    console.error('Error analyzing JD:', error);
    return NextResponse.json(
      { error: 'Failed to analyze job description' },
      { status: 500 }
    );
  }
}
