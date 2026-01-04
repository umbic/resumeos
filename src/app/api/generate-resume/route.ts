import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { generateFullResume } from '@/lib/claude';
import { detectGaps, detectKeywordGaps } from '@/lib/gap-detection';
import { runQualityCheck } from '@/lib/quality-check';
import { autoFixIssues } from '@/lib/quality-fix';
import type { EnhancedJDAnalysis, JDAnalysis } from '@/types';

/**
 * Convert existing JDAnalysis format to EnhancedJDAnalysis format
 * This bridges V1 and V1.5 analysis formats
 */
function convertToEnhancedAnalysis(
  jdAnalysis: JDAnalysis,
  targetTitle: string,
  targetCompany: string
): EnhancedJDAnalysis {
  // Extract positioning themes as priority themes
  const priorityThemes = jdAnalysis.strategic.positioningThemes.slice(0, 3).map((theme) => ({
    theme,
    importance: 'must_have' as const,
    jd_evidence: `Strategic positioning theme for ${targetTitle} role`,
  }));

  // Additional themes as secondary
  const secondaryThemes = jdAnalysis.strategic.positioningThemes.slice(3).map((theme) => ({
    theme,
    importance: 'nice_to_have' as const,
    jd_evidence: `Supporting theme for role`,
  }));

  // Extract ATS keywords with frequency tracking
  const atsKeywords = jdAnalysis.keywords
    .filter((k) => k.priority === 'high' || k.priority === 'medium')
    .map((k) => ({
      keyword: k.keyword,
      frequency: k.frequency || 1, // Default to 1 if not provided
      priority: k.priority,
      category: k.category,
    }));

  return {
    target_title: targetTitle || jdAnalysis.strategic.targetTitle,
    target_company: targetCompany || jdAnalysis.strategic.targetCompany,
    priority_themes: priorityThemes,
    secondary_themes: secondaryThemes,
    ats_keywords: atsKeywords,
    content_mapping: [], // Will be populated by gap detection in Session 4
  };
}

export async function POST(request: NextRequest) {
  try {
    const { sessionId } = await request.json();

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      );
    }

    // Get session with JD analysis
    const sessionResult = await sql`
      SELECT
        id,
        job_description,
        target_title,
        target_company,
        jd_analysis,
        format,
        branding_mode
      FROM sessions
      WHERE id = ${sessionId}
    `;

    if (sessionResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    const session = sessionResult.rows[0];

    // Ensure JD has been analyzed
    if (!session.jd_analysis) {
      return NextResponse.json(
        { error: 'Job description must be analyzed first' },
        { status: 400 }
      );
    }

    // Convert V1 analysis to V1.5 enhanced format
    const jdAnalysis = convertToEnhancedAnalysis(
      session.jd_analysis as JDAnalysis,
      session.target_title,
      session.target_company
    );

    const format = (session.format || 'long') as 'long' | 'short';
    const brandingMode = (session.branding_mode || 'branded') as 'branded' | 'generic';

    // Generate complete resume
    const generatedResume = await generateFullResume({
      jdAnalysis,
      format,
      brandingMode,
      targetCompany: session.target_company || '',
    });

    // Run quality check with ATS keywords for accurate coverage
    let qualityScore = runQualityCheck(generatedResume, jdAnalysis.ats_keywords);

    // Auto-fix critical issues
    let finalResume = generatedResume;
    if (qualityScore.issues.some(i => i.severity === 'error')) {
      const { resume: fixedResume, fixedIssues } = await autoFixIssues(
        generatedResume,
        qualityScore.issues
      );
      finalResume = fixedResume;

      // Re-run quality check after fixes (with ATS keywords)
      qualityScore = runQualityCheck(finalResume, jdAnalysis.ats_keywords);

      // Mark fixed issues
      qualityScore.issues = qualityScore.issues.map(issue => {
        const wasFixed = fixedIssues.some(
          f => f.location === issue.location && f.type === issue.type
        );
        return wasFixed ? { ...issue, autoFixed: true } : issue;
      });
    }

    // Detect gaps between JD themes and generated resume
    const gaps = await detectGaps(jdAnalysis, finalResume);

    // Detect keyword-level gaps (specific ATS keywords missing)
    const keywordGaps = detectKeywordGaps(jdAnalysis.ats_keywords, finalResume);

    // Store the generated resume, gaps, and quality score
    // Format verbs as PostgreSQL array literal: {"verb1","verb2"}
    const verbsArray = finalResume.verbs_used || [];
    const verbsLiteral = `{${verbsArray.map(v => `"${v.replace(/"/g, '\\"')}"`).join(',')}}`;

    await sql`
      UPDATE sessions
      SET
        generated_resume = ${JSON.stringify(finalResume)}::jsonb,
        gaps = ${JSON.stringify(gaps)}::jsonb,
        quality_score = ${JSON.stringify(qualityScore)}::jsonb,
        used_verbs = ${verbsLiteral}::text[],
        generation_version = 'v1.5',
        updated_at = NOW()
      WHERE id = ${sessionId}
    `;

    return NextResponse.json({
      success: true,
      resume: finalResume,
      gaps,
      keyword_gaps: keywordGaps,
      quality_score: qualityScore,
      themes_addressed: finalResume.themes_addressed,
      themes_not_addressed: finalResume.themes_not_addressed,
    });

  } catch (error) {
    console.error('Generate resume error:', error);
    return NextResponse.json(
      { error: 'Failed to generate resume', details: String(error) },
      { status: 500 }
    );
  }
}
