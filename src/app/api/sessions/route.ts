import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

export async function GET() {
  try {
    const result = await sql`
      SELECT
        id,
        name,
        target_title,
        target_company,
        quality_score,
        created_at,
        updated_at
      FROM sessions
      ORDER BY updated_at DESC
    `;

    const sessions = result.rows.map(row => ({
      id: row.id,
      name: row.name,
      target_title: row.target_title,
      target_company: row.target_company,
      quality_score: row.quality_score,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }));

    return NextResponse.json({ sessions });
  } catch (error) {
    console.error('Error fetching sessions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch sessions' },
      { status: 500 }
    );
  }
}
