// src/lib/v3/assembler.ts
// Assembles all chat outputs into final ResumeV3 object

import type {
  ResumeV3,
  Profile,
  SummaryChatOutput,
  CHChatOutput,
  P1ChatOutput,
  P2ChatOutput,
  P3P6ChatOutput,
  JDAnalyzerOutput,
  V3Diagnostics,
} from './types';

export interface AssemblerInput {
  sessionId: string;
  profile: Profile;
  jdAnalysis: JDAnalyzerOutput;
  summaryOutput: SummaryChatOutput;
  chOutput: CHChatOutput;
  p1Output: P1ChatOutput;
  p2Output: P2ChatOutput;
  p3p6Output: P3P6ChatOutput;
  diagnostics: V3Diagnostics;
}

export function assembleResume(input: AssemblerInput): ResumeV3 {
  const {
    sessionId,
    profile,
    jdAnalysis,
    summaryOutput,
    chOutput,
    p1Output,
    p2Output,
    p3p6Output,
    diagnostics,
  } = input;

  return {
    version: '3.0',
    generatedAt: new Date().toISOString(),
    sessionId,

    targetRole: {
      company: jdAnalysis.metadata.company,
      title: jdAnalysis.metadata.title,
      industry: jdAnalysis.metadata.industry,
    },

    header: {
      name: profile.header.name,
      targetTitle: profile.header.targetTitle,
      location: profile.header.location,
      phone: profile.header.phone,
      email: profile.header.email,
      linkedin: profile.header.linkedin,
    },

    summary: summaryOutput.summary.content,

    careerHighlights: chOutput.careerHighlights.map((ch) => ({
      headline: ch.headline,
      content: ch.content,
      sourceId: ch.sourceId,
    })),

    positions: [
      {
        number: 1,
        company: profile.positions[0].company,
        title: profile.positions[0].title,
        location: profile.positions[0].location,
        startDate: profile.positions[0].startDate,
        endDate: profile.positions[0].endDate,
        overview: p1Output.overview.content,
        bullets: p1Output.bullets.map((b) => b.content),
      },
      {
        number: 2,
        company: profile.positions[1].company,
        title: profile.positions[1].title,
        location: profile.positions[1].location,
        startDate: profile.positions[1].startDate,
        endDate: profile.positions[1].endDate,
        overview: p2Output.overview.content,
        bullets: p2Output.bullets.map((b) => b.content),
      },
      ...p3p6Output.overviews.map((ov, idx) => ({
        number: (3 + idx) as 3 | 4 | 5 | 6,
        company: profile.positions[2 + idx]?.company || '',
        title: profile.positions[2 + idx]?.title || '',
        location: profile.positions[2 + idx]?.location || '',
        startDate: profile.positions[2 + idx]?.startDate || '',
        endDate: profile.positions[2 + idx]?.endDate || '',
        overview: ov.content,
        bullets: undefined,
      })),
    ],

    education: profile.education.map((edu) => ({
      institution: edu.institution,
      degree: edu.degree,
      field: edu.field,
      year: edu.year,
    })),

    metadata: {
      thematicAnchors: summaryOutput.thematicAnchors,
      jdCoverage: {
        sections: p2Output.coverageAnalysis.finalCoverage,
        gaps: p2Output.coverageAnalysis.remainingGaps,
        unusedHighPhrases: p2Output.coverageAnalysis.unusedHighPhrases,
      },
      contentSources: {
        summary: summaryOutput.summary.sourcesUsed,
        careerHighlights: chOutput.careerHighlights.map((ch) => ch.sourceId),
        p1Bullets: p1Output.bullets.map((b) => b.sourceId),
        p2Bullets: p2Output.bullets.map((b) => b.sourceId),
        overviews: [
          p1Output.overview.sourceId,
          p2Output.overview.sourceId,
          ...p3p6Output.overviews.map((ov) => ov.sourceId),
        ],
      },
      diagnostics: {
        totalCost: diagnostics.totalCost,
        totalDurationMs: diagnostics.totalDurationMs,
        retryCount: diagnostics.steps.filter((s) => s.retryCount > 0).length,
      },
    },
  };
}
