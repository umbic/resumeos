import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { generateResumeV2 } from '@/lib/claude';
import { detectGaps, detectKeywordGaps } from '@/lib/gap-detection';
import { runQualityCheck } from '@/lib/quality-check';
import { autoFixIssues } from '@/lib/quality-fix';
import type { EnhancedJDAnalysis, JDAnalysis, PositioningTheme, GeneratedResume } from '@/types';
import { CONFLICT_MAP, REVERSE_CONFLICT_MAP } from '@/lib/rules';

// Increase timeout for Claude generation (Vercel Pro: 300s, Hobby: 60s)
export const maxDuration = 60;

/**
 * Check if theme is in new format (object with evidence) or legacy format (string)
 */
function isThemeWithEvidence(theme: unknown): theme is PositioningTheme {
  return typeof theme === 'object' && theme !== null && 'theme' in theme && 'evidence' in theme;
}

/**
 * Convert existing JDAnalysis format to EnhancedJDAnalysis format
 * Now properly preserves JD evidence instead of using placeholders
 */
function convertToEnhancedAnalysis(
  jdAnalysis: JDAnalysis,
  targetTitle: string,
  targetCompany: string
): EnhancedJDAnalysis {
  const themes = jdAnalysis.strategic.positioningThemes;

  // Handle both new format (with evidence) and legacy format (strings)
  const priorityThemes = themes.slice(0, 3).map((theme) => {
    if (isThemeWithEvidence(theme)) {
      // New format: use actual evidence and quotes
      const quotesText = theme.jd_quotes?.length > 0
        ? ` Key phrases: "${theme.jd_quotes.join('", "')}"`
        : '';
      return {
        theme: theme.theme,
        importance: 'must_have' as const,
        jd_evidence: `${theme.evidence}${quotesText}`,
      };
    }
    // Legacy format: string only (fallback for old sessions)
    return {
      theme: theme as unknown as string,
      importance: 'must_have' as const,
      jd_evidence: `Strategic theme for ${targetTitle} at ${targetCompany}`,
    };
  });

  // Additional themes as secondary
  const secondaryThemes = themes.slice(3).map((theme) => {
    if (isThemeWithEvidence(theme)) {
      const quotesText = theme.jd_quotes?.length > 0
        ? ` Key phrases: "${theme.jd_quotes.join('", "')}"`
        : '';
      return {
        theme: theme.theme,
        importance: 'nice_to_have' as const,
        jd_evidence: `${theme.evidence}${quotesText}`,
      };
    }
    return {
      theme: theme as unknown as string,
      importance: 'nice_to_have' as const,
      jd_evidence: `Supporting theme for role`,
    };
  });

  // Extract ATS keywords with frequency tracking AND placement
  const atsKeywords = jdAnalysis.keywords
    .filter((k) => k.priority === 'high' || k.priority === 'medium')
    .map((k) => ({
      keyword: k.keyword,
      frequency: k.frequency || 1,
      priority: k.priority,
      category: k.category,
      placement: k.placement || 'unknown', // Preserve placement data
    }));

  return {
    target_title: targetTitle || jdAnalysis.strategic.targetTitle,
    target_company: targetCompany || jdAnalysis.strategic.targetCompany,
    priority_themes: priorityThemes,
    secondary_themes: secondaryThemes,
    ats_keywords: atsKeywords,
    content_mapping: [],
  };
}

/**
 * Validate that no conflict pairs were used together in the generated resume.
 * Returns array of violation descriptions.
 */
function validateNoConflicts(resume: GeneratedResume): string[] {
  const violations: string[] = [];
  const usedIds = new Set<string>();

  // Collect all used content IDs from content_ids_used
  if (resume.content_ids_used) {
    for (const id of resume.content_ids_used) {
      usedIds.add(id);
      // Also add base ID if this is a variant (e.g., CH-01-V1 -> CH-01)
      const baseMatch = id.match(/^([A-Z]+-\d+)/);
      if (baseMatch) {
        usedIds.add(baseMatch[1]);
      }
    }
  }

  // Check for conflicts using CONFLICT_MAP
  for (const [chId, conflictingBullets] of Object.entries(CONFLICT_MAP)) {
    if (usedIds.has(chId)) {
      for (const bulletId of conflictingBullets) {
        if (usedIds.has(bulletId)) {
          violations.push(`CONFLICT: ${chId} and ${bulletId} both used (same achievement/metric)`);
        }
      }
    }
  }

  // Also check reverse direction
  for (const [bulletId, conflictingCHs] of Object.entries(REVERSE_CONFLICT_MAP)) {
    if (usedIds.has(bulletId)) {
      for (const chId of conflictingCHs) {
        // Only log if not already caught above
        if (usedIds.has(chId) && !violations.some(v => v.includes(chId) && v.includes(bulletId))) {
          violations.push(`CONFLICT: ${bulletId} and ${chId} both used (same achievement/metric)`);
        }
      }
    }
  }

  return violations;
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

    // Note: format and brandingMode are preserved for future V2 enhancements
    const _format = (session.format || 'long') as 'long' | 'short';
    const _brandingMode = (session.branding_mode || 'branded') as 'branded' | 'generic';
    void _format;
    void _brandingMode;

    // Generate complete resume using V2 (code-based selection + LLM rewrite)
    const { resume: generatedResume, selection } = await generateResumeV2(jdAnalysis);

    console.log('[generate-resume] V2 selection debug:', selection.debug);

    // Validate no conflict pairs were used together
    const conflictViolations = validateNoConflicts(generatedResume);
    if (conflictViolations.length > 0) {
      console.warn('Conflict violations detected in generated resume:', conflictViolations);
      // Note: In future, could auto-fix by removing the position bullet
    }

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
        keyword_gaps = ${JSON.stringify(keywordGaps)}::jsonb,
        quality_score = ${JSON.stringify(qualityScore)}::jsonb,
        used_verbs = ${verbsLiteral}::text[],
        generation_version = 'v2',
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
      conflict_violations: conflictViolations, // Include any conflict violations
      selection_debug: selection.debug, // V2: Include selection scoring debug info
    });

  } catch (error) {
    console.error('Generate resume error:', error);
    return NextResponse.json(
      { error: 'Failed to generate resume', details: String(error) },
      { status: 500 }
    );
  }
}
