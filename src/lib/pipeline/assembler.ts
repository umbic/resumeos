// ============================================================
// ResumeOS V2.1: Resume Assembler
// ============================================================
//
// Combines AI-written content with DB-sourced structure.
// CRITICAL: Structure (header, companies, titles, dates) comes from profile DB.
// Only prose content (summary, bullets, overviews) comes from AI.
// This eliminates hallucination of structural data.

import { ProfileData } from '@/types/profile';
import {
  NarrativeWriterOutput,
  DetailWriterOutput,
  AssembledResume,
  ResumePosition,
} from '@/types/v2.1';

export interface AssemblerInput {
  profile: ProfileData;
  narrativeOutput: NarrativeWriterOutput;
  detailOutput: DetailWriterOutput;
  targetTitle?: string;
}

/**
 * Assemble the final resume
 *
 * CRITICAL: Structure (header, companies, titles, dates) comes from profile DB.
 * Only prose content (summary, bullets, overviews) comes from AI.
 * This eliminates hallucination of structural data.
 */
export function assembleResume(input: AssemblerInput): AssembledResume {
  const { profile, narrativeOutput, detailOutput, targetTitle } = input;

  // Build positions array
  const positions: ResumePosition[] = [];

  // Position 1: Structure from DB, content from AI
  if (profile.positions[0]) {
    positions.push({
      company: profile.positions[0].company,
      title: profile.positions[0].title,
      location: profile.positions[0].location,
      startDate: profile.positions[0].startDate,
      endDate: profile.positions[0].endDate,
      overview: detailOutput.position1.overview.content,
      bullets: detailOutput.position1.bullets.map((b) => b.content),
    });
  }

  // Position 2: Structure from DB, content from AI
  if (profile.positions[1]) {
    positions.push({
      company: profile.positions[1].company,
      title: profile.positions[1].title,
      location: profile.positions[1].location,
      startDate: profile.positions[1].startDate,
      endDate: profile.positions[1].endDate,
      overview: detailOutput.position2.overview.content,
      bullets: detailOutput.position2.bullets.map((b) => b.content),
    });
  }

  // Positions 3-6: Entirely from DB (static overviews, no bullets)
  for (let i = 2; i < profile.positions.length; i++) {
    const pos = profile.positions[i];
    positions.push({
      company: pos.company,
      title: pos.title,
      location: pos.location,
      startDate: pos.startDate,
      endDate: pos.endDate,
      overview: pos.overview, // Static from DB
      bullets: [], // No bullets for older positions
    });
  }

  // Collect all source IDs for metadata
  const sourcesUsed = {
    summary: narrativeOutput.summary.sourcesUsed,
    careerHighlights: narrativeOutput.careerHighlights.map((ch) => ch.sourceId),
    position1: [
      detailOutput.position1.overview.sourceId,
      ...detailOutput.position1.bullets.map((b) => b.sourceId),
    ],
    position2: [
      detailOutput.position2.overview.sourceId,
      ...detailOutput.position2.bullets.map((b) => b.sourceId),
    ],
  };

  return {
    header: {
      name: profile.name,
      targetTitle: targetTitle || profile.defaultTitle,
      location: profile.location,
      phone: profile.phone,
      email: profile.email,
    },
    summary: narrativeOutput.summary.content,
    careerHighlights: narrativeOutput.careerHighlights.map((ch) => ch.content),
    positions,
    education: {
      school: profile.education.school,
      degree: profile.education.degree,
      field: profile.education.field,
    },
    _meta: {
      assembledAt: new Date().toISOString(),
      sourcesUsed,
    },
  };
}

/**
 * Format assembled resume as markdown (for preview)
 */
export function formatResumeAsMarkdown(resume: AssembledResume): string {
  let md = '';

  // Header
  md += `# ${resume.header.name}\n\n`;
  md += `**${resume.header.targetTitle}**\n\n`;
  md += `${resume.header.location} | ${resume.header.phone} | ${resume.header.email}\n\n`;
  md += '---\n\n';

  // Summary
  md += `## Summary\n\n${resume.summary}\n\n`;
  md += '---\n\n';

  // Career Highlights
  md += '## Career Highlights\n\n';
  resume.careerHighlights.forEach((ch) => {
    md += `- ${ch}\n\n`;
  });
  md += '---\n\n';

  // Positions
  md += '## Professional Experience\n\n';
  resume.positions.forEach((pos) => {
    md += `### ${pos.title}\n`;
    md += `**${pos.company}** | ${pos.location} | ${pos.startDate} - ${pos.endDate}\n\n`;
    if (pos.overview) {
      md += `${pos.overview}\n\n`;
    }
    if (pos.bullets.length > 0) {
      pos.bullets.forEach((bullet) => {
        md += `- ${bullet}\n\n`;
      });
    }
  });
  md += '---\n\n';

  // Education
  md += '## Education\n\n';
  md += `**${resume.education.school}**\n`;
  md += `${resume.education.degree} | ${resume.education.field}\n`;

  return md;
}

/**
 * Format assembled resume as JSON (for DOCX generation)
 */
export function formatResumeAsJSON(resume: AssembledResume): string {
  return JSON.stringify(resume, null, 2);
}
