// ============================================
// ResumeOS V2: Diagnostics API Endpoint
// ============================================
//
// Returns comprehensive diagnostics for a v2 pipeline session,
// including all agent prompts, responses, timing, and costs.

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sessions } from '@/drizzle/schema';
import { eq } from 'drizzle-orm';
import type { PipelineSession, PipelineDiagnostics } from '@/types/v2';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;

    const [row] = await db
      .select()
      .from(sessions)
      .where(eq(sessions.id, sessionId));

    if (!row) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    const session = row.v2Session as PipelineSession | null;
    const diagnostics = row.v2Diagnostics as PipelineDiagnostics | null;

    if (!session) {
      return NextResponse.json(
        { error: 'No V2 session data found for this session' },
        { status: 400 }
      );
    }

    // Build comprehensive diagnostics response
    const response = {
      overview: {
        sessionId,
        state: session.state,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
        totalCost: diagnostics?.costs?.totalUSD || 0,
        totalDurationMs: diagnostics?.timing?.totalDurationMs || 0,
        jobDescriptionPreview: session.jobDescription?.substring(0, 300) + '...',
        companyName: session.companyName,
        targetTitle: session.targetTitle,
        error: session.error,
      },

      agents: {
        jdStrategist: diagnostics?.agents?.jdStrategist
          ? {
              promptSent: diagnostics.agents.jdStrategist.promptSent,
              rawResponse: diagnostics.agents.jdStrategist.rawResponse,
              parsedOutput: session.jdStrategy,
              inputTokens: diagnostics.agents.jdStrategist.inputTokens,
              outputTokens: diagnostics.agents.jdStrategist.outputTokens,
              cost: diagnostics.agents.jdStrategist.cost,
              durationMs: diagnostics.agents.jdStrategist.durationMs,
              timestamp: diagnostics.agents.jdStrategist.timestamp,
            }
          : null,

        gapAnalyzer: diagnostics?.agents?.gapAnalyzer
          ? {
              promptSent: diagnostics.agents.gapAnalyzer.promptSent,
              rawResponse: diagnostics.agents.gapAnalyzer.rawResponse,
              parsedOutput: session.gapAnalysis,
              inputTokens: diagnostics.agents.gapAnalyzer.inputTokens,
              outputTokens: diagnostics.agents.gapAnalyzer.outputTokens,
              cost: diagnostics.agents.gapAnalyzer.cost,
              durationMs: diagnostics.agents.gapAnalyzer.durationMs,
              timestamp: diagnostics.agents.gapAnalyzer.timestamp,
            }
          : null,

        resumeWriter: diagnostics?.agents?.resumeWriter
          ? {
              promptSent: diagnostics.agents.resumeWriter.promptSent,
              rawResponse: diagnostics.agents.resumeWriter.rawResponse,
              parsedOutput: session.writerOutput,
              inputTokens: diagnostics.agents.resumeWriter.inputTokens,
              outputTokens: diagnostics.agents.resumeWriter.outputTokens,
              cost: diagnostics.agents.resumeWriter.cost,
              durationMs: diagnostics.agents.resumeWriter.durationMs,
              timestamp: diagnostics.agents.resumeWriter.timestamp,
            }
          : null,

        validator: diagnostics?.agents?.validator
          ? {
              promptSent: diagnostics.agents.validator.promptSent,
              rawResponse: diagnostics.agents.validator.rawResponse,
              parsedOutput: session.validationResult,
              inputTokens: diagnostics.agents.validator.inputTokens,
              outputTokens: diagnostics.agents.validator.outputTokens,
              cost: diagnostics.agents.validator.cost,
              durationMs: diagnostics.agents.validator.durationMs,
              timestamp: diagnostics.agents.validator.timestamp,
            }
          : null,
      },

      contentSelection: diagnostics?.contentSelection
        ? {
            signals: diagnostics.contentSelection.signals,
            selectedItems: diagnostics.contentSelection.selectedItems,
            conflictsApplied: diagnostics.contentSelection.conflictsApplied,
            durationMs: diagnostics.contentSelection.durationMs,
            allScores: diagnostics.contentSelection.allScores,
            selection: session.sourceSelection
              ? {
                  summaryCount: session.sourceSelection.summary?.sources?.length || 0,
                  careerHighlightsCount: session.sourceSelection.careerHighlights?.length || 0,
                  position1BulletsCount:
                    session.sourceSelection.position1?.bullets?.length || 0,
                  position2BulletsCount:
                    session.sourceSelection.position2?.bullets?.length || 0,
                  positions3to6Count:
                    session.sourceSelection.positions3to6?.length || 0,
                  details: session.sourceSelection,
                }
              : null,
          }
        : {
            signals: session.sourceSelection?.debug?.jdSignals || null,
            selectedItems: null,
            conflictsApplied: session.sourceSelection?.debug?.conflictsApplied || [],
            durationMs: 0,
            allScores: session.sourceSelection?.debug?.scoringBreakdown || [],
            selection: session.sourceSelection
              ? {
                  summaryCount: session.sourceSelection.summary?.sources?.length || 0,
                  careerHighlightsCount: session.sourceSelection.careerHighlights?.length || 0,
                  position1BulletsCount:
                    session.sourceSelection.position1?.bullets?.length || 0,
                  position2BulletsCount:
                    session.sourceSelection.position2?.bullets?.length || 0,
                  positions3to6Count:
                    session.sourceSelection.positions3to6?.length || 0,
                  details: session.sourceSelection,
                }
              : null,
          },

      userIntervention: diagnostics?.userIntervention
        ? {
            adjustmentsMade: diagnostics.userIntervention.adjustmentsMade,
            timeToApproveMs: diagnostics.userIntervention.timeToApproveMs,
          }
        : session.userAdjustments
          ? {
              adjustmentsMade: session.userAdjustments,
              timeToApproveMs: null,
            }
          : null,

      finalOutput: session.writerOutput
        ? {
            summary: session.writerOutput.summary?.content,
            summarySources: session.writerOutput.summary?.sourcesUsed,
            careerHighlightsCount: session.writerOutput.careerHighlights?.length || 0,
            careerHighlights: session.writerOutput.careerHighlights,
            positionsCount: session.writerOutput.positions?.length || 0,
            positions: session.writerOutput.positions,
            metadata: session.writerOutput.writingMetadata,
          }
        : null,

      validation: session.validationResult
        ? {
            passed: session.validationResult.passed,
            overallScore: session.validationResult.overallScore,
            scores: {
              honesty: session.validationResult.honesty.score,
              honestyPassed: session.validationResult.honesty.passed,
              coverage: session.validationResult.coverage.score,
              coveragePassed: session.validationResult.coverage.passed,
              quality: session.validationResult.quality.score,
              qualityPassed: session.validationResult.quality.passed,
            },
            honestyIssues: session.validationResult.honesty.issues,
            metricsVerified: session.validationResult.honesty.metricsVerified,
            requirementsAddressed:
              session.validationResult.coverage.requirementsAddressed,
            positioningServed:
              session.validationResult.coverage.positioningServed,
            qualityIssues: session.validationResult.quality.issues,
            verbUsage: session.validationResult.quality.verbUsage,
            suggestedFixes: session.validationResult.suggestedFixes,
          }
        : null,

      // Raw data for full export
      rawSession: session,
      rawDiagnostics: diagnostics,
    };

    return NextResponse.json({
      success: true,
      diagnostics: response,
    });
  } catch (error) {
    console.error('Diagnostics error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to fetch diagnostics',
      },
      { status: 500 }
    );
  }
}
