import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { analyzeJobDescription } from '@/lib/claude';
import { generateEmbedding } from '@/lib/openai';
import { COMPETITOR_MAP, filterExecutiveKeywords } from '@/lib/rules';

export async function POST(request: NextRequest) {
  try {
    const { jobDescription, name } = await request.json();

    if (!jobDescription) {
      return NextResponse.json(
        { error: 'Job description is required' },
        { status: 400 }
      );
    }

    // Analyze JD with Claude (enhanced two-layer analysis)
    const { analysis, recommendedBrandingMode: claudeBrandingMode, reasoning } =
      await analyzeJobDescription(jobDescription);

    // Filter out junior/tactical keywords
    const filteredKeywords = filterExecutiveKeywords(analysis.keywords);

    // Update analysis with filtered keywords
    const filteredAnalysis = {
      ...analysis,
      keywords: filteredKeywords,
    };

    // Generate embedding for the JD
    const jdEmbedding = await generateEmbedding(jobDescription);
    const embeddingStr = `[${jdEmbedding.join(',')}]`;

    // Determine branding mode based on target company
    let finalBrandingMode = claudeBrandingMode || 'branded';
    const competitorBrands = COMPETITOR_MAP[analysis.strategic.targetCompany] || [];
    if (competitorBrands.length > 0) {
      finalBrandingMode = 'generic';
    }

    // Extract simple keyword strings for backward compatibility
    const simpleKeywords = filteredKeywords.map((k) => k.keyword);

    // Create new session with enhanced jd_analysis
    const result = await sql`
      INSERT INTO sessions (
        name,
        job_description,
        target_title,
        target_company,
        industry,
        keywords,
        themes,
        jd_embedding,
        branding_mode,
        jd_analysis
      ) VALUES (
        ${name || null},
        ${jobDescription},
        ${analysis.strategic.targetTitle},
        ${analysis.strategic.targetCompany},
        ${analysis.strategic.industry},
        ${JSON.stringify(simpleKeywords)},
        ${JSON.stringify(analysis.strategic.positioningThemes)},
        ${embeddingStr}::vector,
        ${finalBrandingMode},
        ${JSON.stringify(filteredAnalysis)}
      )
      RETURNING id
    `;

    const sessionId = result.rows[0].id;

    return NextResponse.json({
      sessionId,
      analysis: {
        // New structured format
        strategic: analysis.strategic,
        keywords: filteredKeywords,
        // Backward compatible flat format
        targetTitle: analysis.strategic.targetTitle,
        targetCompany: analysis.strategic.targetCompany,
        industry: analysis.strategic.industry,
        themes: analysis.strategic.positioningThemes,
        recommendedBrandingMode: finalBrandingMode,
        reasoning,
      },
    });
  } catch (error) {
    console.error('Error analyzing JD:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: `Failed to analyze job description: ${errorMessage}` },
      { status: 500 }
    );
  }
}
