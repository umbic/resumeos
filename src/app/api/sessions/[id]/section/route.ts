import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import type { GeneratedResume } from '@/types';

function updateGeneratedResume(
  resume: GeneratedResume,
  sectionKey: string,
  content: string
): GeneratedResume {
  if (sectionKey === 'summary') {
    return { ...resume, summary: content };
  }

  if (sectionKey.startsWith('highlight_')) {
    const index = parseInt(sectionKey.split('_')[1]) - 1;
    const highlights = [...resume.career_highlights];
    highlights[index] = content;
    return { ...resume, career_highlights: highlights };
  }

  if (sectionKey.startsWith('position_')) {
    const parts = sectionKey.split('_');
    const posNum = parseInt(parts[1]);
    const field = parts[2];

    const positions = resume.positions.map((p) => {
      if (p.number !== posNum) return p;

      if (field === 'overview') {
        return { ...p, overview: content };
      }

      if (field === 'bullet') {
        const bulletIndex = parseInt(parts[3]) - 1;
        const bullets = [...(p.bullets || [])];
        bullets[bulletIndex] = content;
        return { ...p, bullets };
      }

      return p;
    });

    return { ...resume, positions };
  }

  return resume;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const { sectionKey, content } = await request.json();

    if (!sectionKey || typeof content !== 'string') {
      return NextResponse.json(
        { error: 'sectionKey and content are required' },
        { status: 400 }
      );
    }

    // Get current session
    const sessionResult = await sql`
      SELECT generated_resume
      FROM sessions
      WHERE id = ${id}
    `;

    if (sessionResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    const currentResume = sessionResult.rows[0].generated_resume as GeneratedResume;

    if (!currentResume) {
      return NextResponse.json(
        { error: 'No generated resume found for this session' },
        { status: 400 }
      );
    }

    // Update the specific section
    const updatedResume = updateGeneratedResume(currentResume, sectionKey, content);

    // Save to database
    const updateResult = await sql`
      UPDATE sessions
      SET
        generated_resume = ${JSON.stringify(updatedResume)}::jsonb,
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING updated_at
    `;

    return NextResponse.json({
      success: true,
      updated_at: updateResult.rows[0].updated_at,
      resume: updatedResume,
    });
  } catch (error) {
    console.error('Error updating section:', error);
    return NextResponse.json(
      { error: 'Failed to update section' },
      { status: 500 }
    );
  }
}
