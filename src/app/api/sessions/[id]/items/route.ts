import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import type { GeneratedResume } from '@/types';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const { action, type, index, positionNumber, content } = await request.json();

    // Get current resume
    const result = await sql`
      SELECT generated_resume FROM sessions WHERE id = ${id}
    `;

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const resume = result.rows[0].generated_resume as GeneratedResume;

    if (action === 'add') {
      if (type === 'highlight') {
        // Add new highlight with placeholder
        const newHighlight = content || '[New highlight - click to edit]';
        resume.career_highlights = [...resume.career_highlights, newHighlight];
      } else if (type === 'bullet' && positionNumber) {
        // Add bullet to specific position
        const newBullet = content || '[New bullet - click to edit]';
        resume.positions = resume.positions.map(p => {
          if (p.number === positionNumber) {
            return {
              ...p,
              bullets: [...(p.bullets || []), newBullet],
            };
          }
          return p;
        });
      }
    } else if (action === 'remove') {
      if (type === 'highlight' && typeof index === 'number') {
        // Remove highlight at index
        resume.career_highlights = resume.career_highlights.filter((_, i) => i !== index);
      } else if (type === 'bullet' && typeof index === 'number' && positionNumber) {
        // Remove bullet from specific position
        resume.positions = resume.positions.map(p => {
          if (p.number === positionNumber) {
            return {
              ...p,
              bullets: (p.bullets || []).filter((_, i) => i !== index),
            };
          }
          return p;
        });
      }
    }

    // Save updated resume
    await sql`
      UPDATE sessions
      SET generated_resume = ${JSON.stringify(resume)}::jsonb, updated_at = NOW()
      WHERE id = ${id}
    `;

    return NextResponse.json({ success: true, resume });
  } catch (error) {
    console.error('Error modifying items:', error);
    return NextResponse.json(
      { error: 'Failed to modify items' },
      { status: 500 }
    );
  }
}
