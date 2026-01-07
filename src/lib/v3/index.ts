// src/lib/v3/index.ts
// Main entry point for V3 pipeline

import type { V3Input, V3Result, ResumeV3, Profile, ContentSources } from './types';
import { runV3Pipeline, type OrchestratorConfig } from './orchestrator';
import { loadContentSources, DEFAULT_PROFILE } from './content-loader';
import { assembleResume } from './assembler';
import { generateDocx } from './docx-generator';
import { generateCoverageReport, type CoverageReport } from './coverage-report';
import masterContent from '@/data/master-content.json';

export interface GenerateResumeV3Options {
  profile?: Profile;
  contentSources?: ContentSources;
  maxRetries?: number;
  model?: string;
}

export interface GenerateResumeV3Result {
  success: boolean;
  resume?: ResumeV3;
  coverageReport?: CoverageReport;
  diagnostics: V3Result['diagnostics'];
  error?: string;
}

/**
 * Main V3 generation function
 * Takes a job description and generates a tailored resume
 */
export async function generateResumeV3(
  jobDescription: string,
  options: GenerateResumeV3Options = {}
): Promise<GenerateResumeV3Result> {
  // Load content sources from master-content.json if not provided
  const contentSources = options.contentSources || loadContentSources(masterContent as never);
  const profile = options.profile || DEFAULT_PROFILE;

  // Build input
  const input: V3Input = {
    jobDescription,
    profileId: 'default',
  };

  // Build orchestrator config
  const config: OrchestratorConfig = {
    profile,
    contentSources,
    maxRetries: options.maxRetries,
    model: options.model,
  };

  // Run the pipeline
  const pipelineResult = await runV3Pipeline(input, config);

  if (!pipelineResult.success) {
    return {
      success: false,
      diagnostics: pipelineResult.diagnostics,
      error: pipelineResult.diagnostics.errors[0]?.error || 'Pipeline failed',
    };
  }

  // Assemble the resume
  const resume = assembleResume({
    sessionId: pipelineResult.sessionId,
    profile,
    jdAnalysis: pipelineResult.jdAnalysis,
    summaryOutput: pipelineResult.summary,
    chOutput: pipelineResult.careerHighlights,
    p1Output: pipelineResult.position1,
    p2Output: pipelineResult.position2,
    p3p6Output: pipelineResult.positions3to6,
    diagnostics: pipelineResult.diagnostics,
  });

  // Generate coverage report
  const coverageReport = generateCoverageReport(resume, pipelineResult.jdAnalysis);

  return {
    success: true,
    resume,
    coverageReport,
    diagnostics: pipelineResult.diagnostics,
  };
}

/**
 * Generate DOCX buffer from resume
 */
export async function generateResumeDocx(resume: ResumeV3): Promise<Buffer> {
  const { Packer } = await import('docx');
  const doc = generateDocx(resume);
  return Packer.toBuffer(doc);
}

// Re-export types and utilities
export type { V3Input, V3Result, ResumeV3, Profile, ContentSources, CoverageReport };
export { loadContentSources, DEFAULT_PROFILE } from './content-loader';
export { assembleResume } from './assembler';
export { generateDocx } from './docx-generator';
export { generateCoverageReport } from './coverage-report';
export { runV3Pipeline } from './orchestrator';
export { V3_MODEL, calculateCost } from './claude-client';
