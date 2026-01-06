// ============================================================
// ResumeOS V2.1: DOCX Export Endpoint
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sessions } from '@/drizzle/schema';
import { eq } from 'drizzle-orm';
import { Packer } from 'docx';
import { generateResumeDocument } from '@/lib/docx-export';
import { STATIC_CONTENT } from '@/lib/rules';
import type { AssembledResume } from '@/types/v2.1';

export async function POST(request: NextRequest) {
  try {
    const { sessionId } = await request.json();

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      );
    }

    // Get session data
    const [row] = await db.select().from(sessions).where(eq(sessions.id, sessionId));

    if (!row) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    const v2Session = row.v2Session as unknown as Record<string, unknown> | null;
    if (!v2Session) {
      return NextResponse.json(
        { error: 'Session has no V2 data' },
        { status: 400 }
      );
    }

    const assembledResume = v2Session.assembledResume as AssembledResume | undefined;
    if (!assembledResume) {
      return NextResponse.json(
        { error: 'Resume not yet generated' },
        { status: 400 }
      );
    }

    // Convert AssembledResume to format expected by generateResumeDocument
    const positions: Record<number, {
      title: string;
      company: string;
      location: string;
      dates: string;
      overview: string;
      bullets: string[];
    }> = {};

    assembledResume.positions.forEach((pos, index) => {
      positions[index + 1] = {
        title: pos.title,
        company: pos.company,
        location: pos.location,
        dates: `${pos.startDate} - ${pos.endDate}`,
        overview: pos.overview || '',
        bullets: pos.bullets || [],
      };
    });

    const header = {
      name: assembledResume.header.name,
      title: assembledResume.header.targetTitle,
      location: assembledResume.header.location,
      phone: assembledResume.header.phone,
      email: assembledResume.header.email,
    };

    // Generate document
    const doc = generateResumeDocument({
      header,
      summary: assembledResume.summary,
      highlights: assembledResume.careerHighlights,
      positions,
      education: STATIC_CONTENT.education,
      format: 'long', // V2.1 always uses long format
    });

    // Generate buffer
    const buffer = await Packer.toBuffer(doc);

    // Return as downloadable file
    const filename = `${header.name.replace(/\s+/g, '_')}_Resume_${new Date().toISOString().split('T')[0]}.docx`;

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('Error exporting V2.1 DOCX:', error);
    return NextResponse.json(
      { error: 'Failed to export document' },
      { status: 500 }
    );
  }
}
