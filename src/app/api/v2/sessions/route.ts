// ============================================
// ResumeOS V2: Sessions List Endpoint
// ============================================
//
// Returns all V2 pipeline sessions for the dashboard.

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sessions } from '@/drizzle/schema';
import { desc, isNotNull } from 'drizzle-orm';
import type { PipelineSession, PipelineDiagnostics } from '@/types/v2';

export async function GET() {
  try {
    const rows = await db
      .select({
        id: sessions.id,
        createdAt: sessions.createdAt,
        updatedAt: sessions.updatedAt,
        jobDescription: sessions.jobDescription,
        targetCompany: sessions.targetCompany,
        targetTitle: sessions.targetTitle,
        v2Session: sessions.v2Session,
        v2Status: sessions.v2Status,
        v2Diagnostics: sessions.v2Diagnostics,
      })
      .from(sessions)
      .where(isNotNull(sessions.v2Session))
      .orderBy(desc(sessions.createdAt))
      .limit(50);

    const sessionList = rows.map((row) => {
      const v2Session = row.v2Session as PipelineSession | null;
      const diagnostics = row.v2Diagnostics as PipelineDiagnostics | null;

      // Extract company name from JD strategy if available
      const companyName = v2Session?.jdStrategy?.company?.name ||
                          row.targetCompany ||
                          extractCompanyFromJD(row.jobDescription);

      // Extract role title
      const roleTitle = v2Session?.jdStrategy?.role?.title ||
                        row.targetTitle ||
                        'Marketing Role';

      return {
        id: row.id,
        companyName,
        roleTitle,
        state: v2Session?.state || row.v2Status || 'unknown',
        createdAt: row.createdAt?.toISOString() || v2Session?.createdAt,
        updatedAt: row.updatedAt?.toISOString() || v2Session?.updatedAt,

        // Quick stats
        validationPassed: v2Session?.validationResult?.passed ?? null,
        validationScore: v2Session?.validationResult?.overallScore ?? null,
        totalCost: diagnostics?.costs?.totalUSD ?? null,

        // Preview of JD (first 150 chars)
        jdPreview: row.jobDescription?.substring(0, 150) + '...',
      };
    });

    return NextResponse.json({
      success: true,
      sessions: sessionList,
      count: sessionList.length,
    });
  } catch (error) {
    console.error('Sessions list error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch sessions' },
      { status: 500 }
    );
  }
}

// Simple heuristic to extract company name from JD text
function extractCompanyFromJD(jd: string | null): string {
  if (!jd) return 'Unknown Company';

  // Look for common patterns like "About [Company]" or "[Company] is..."
  const patterns = [
    /About\s+(?:the\s+)?(?:Role\s+at\s+)?([A-Z][A-Za-z0-9]+)/,
    /^([A-Z][A-Za-z0-9]+)\s+is\s+(?:on\s+a\s+mission|seeking|looking|hiring)/m,
    /Join\s+([A-Z][A-Za-z0-9]+)/,
    /at\s+([A-Z][A-Za-z0-9]+)(?:\s+we|\s+you)/i,
  ];

  for (const pattern of patterns) {
    const match = jd.match(pattern);
    if (match && match[1] && match[1].length > 2) {
      return match[1];
    }
  }

  return 'Unknown Company';
}
