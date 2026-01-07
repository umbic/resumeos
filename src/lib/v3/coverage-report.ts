// src/lib/v3/coverage-report.ts
// Generates JD coverage analysis report

import type { ResumeV3, JDAnalyzerOutput } from './types';

export interface CoverageReport {
  overall: {
    score: number;
    grade: 'A' | 'B' | 'C' | 'D' | 'F';
  };

  sections: {
    name: string;
    coverage: 'Strong' | 'Partial' | 'Gap';
    proofPoints: number;
  }[];

  phrases: {
    highUsed: number;
    highTotal: number;
    mediumUsed: number;
    mediumTotal: number;
  };

  gaps: {
    requirement: string;
    severity: string;
    notes: string;
  }[];

  recommendations: string[];
}

export function generateCoverageReport(
  resume: ResumeV3,
  jdAnalysis: JDAnalyzerOutput
): CoverageReport {
  const { jdCoverage } = resume.metadata;

  // Calculate section scores
  const sectionScores: number[] = jdCoverage.sections.map((s) => {
    if (s.strength === 'Strong') return 1;
    if (s.strength === 'Partial') return 0.5;
    return 0;
  });
  const sectionScore = sectionScores.reduce((a, b) => a + b, 0) / Math.max(sectionScores.length, 1);

  // Calculate phrase usage
  const allHighPhrases = jdAnalysis.sections.flatMap((s) =>
    s.keyPhrases.filter((p) => p.weight === 'HIGH')
  );
  const allMediumPhrases = jdAnalysis.sections.flatMap((s) =>
    s.keyPhrases.filter((p) => p.weight === 'MEDIUM')
  );

  const unusedHigh = jdCoverage.unusedHighPhrases.length;
  const highUsed = allHighPhrases.length - unusedHigh;

  const phraseScore = highUsed / Math.max(allHighPhrases.length, 1);

  // Calculate gap penalty
  const highGaps = jdCoverage.gaps.filter((g) => g.severity === 'High').length;
  const gapPenalty = highGaps * 0.1;

  // Overall score
  const rawScore = (sectionScore * 0.5 + phraseScore * 0.4) * 100;
  const finalScore = Math.max(0, Math.min(100, rawScore - gapPenalty * 100));

  // Grade
  const grade: 'A' | 'B' | 'C' | 'D' | 'F' =
    finalScore >= 90
      ? 'A'
      : finalScore >= 80
        ? 'B'
        : finalScore >= 70
          ? 'C'
          : finalScore >= 60
            ? 'D'
            : 'F';

  // Generate recommendations
  const recommendations: string[] = [];

  if (unusedHigh > 0) {
    recommendations.push(
      `${unusedHigh} HIGH-weight phrases weren't used: ${jdCoverage.unusedHighPhrases.slice(0, 3).join(', ')}${unusedHigh > 3 ? '...' : ''}`
    );
  }

  const gapSections = jdCoverage.sections.filter((s) => s.strength === 'Gap');
  if (gapSections.length > 0) {
    recommendations.push(`JD sections with gaps: ${gapSections.map((s) => s.section).join(', ')}`);
  }

  for (const gap of jdCoverage.gaps.filter((g) => g.severity === 'High')) {
    recommendations.push(`High-risk gap: ${gap.gap}`);
  }

  return {
    overall: { score: Math.round(finalScore), grade },
    sections: jdCoverage.sections.map((s) => ({
      name: s.section,
      coverage: s.strength,
      proofPoints: s.coveredBy.length,
    })),
    phrases: {
      highUsed,
      highTotal: allHighPhrases.length,
      mediumUsed: 0, // Would need to calculate from all jdMappings
      mediumTotal: allMediumPhrases.length,
    },
    gaps: jdCoverage.gaps.map((g) => ({
      requirement: g.gap,
      severity: g.severity,
      notes: g.notes,
    })),
    recommendations,
  };
}
