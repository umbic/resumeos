import { drizzle } from 'drizzle-orm/vercel-postgres';
import { sql } from '@vercel/postgres';
import * as schema from '@/drizzle/schema';

export const db = drizzle(sql, { schema });

// Helper to execute raw SQL for pgvector operations
export async function executeRaw<T>(query: string, params: unknown[] = []): Promise<T> {
  const result = await sql.query(query, params);
  return result.rows as T;
}

// Semantic search helper using pgvector
export async function semanticSearch(
  embedding: number[],
  type: string,
  position: number | null,
  blockedIds: string[],
  limit: number = 5
) {
  const embeddingStr = `[${embedding.join(',')}]`;
  const blockedList = blockedIds.length > 0 ? blockedIds.map(id => `'${id}'`).join(',') : "''";

  const positionClause = position !== null ? `AND position = ${position}` : '';
  const blockedClause = blockedIds.length > 0 ? `AND id NOT IN (${blockedList})` : '';

  const query = `
    SELECT
      id,
      type,
      position,
      content_short,
      content_medium,
      content_long,
      content_generic,
      brand_tags,
      category_tags,
      function_tags,
      outcome_tags,
      exclusive_metrics,
      1 - (embedding::vector <=> '${embeddingStr}'::vector) as similarity
    FROM content_items
    WHERE type = $1
      ${positionClause}
      ${blockedClause}
      AND embedding IS NOT NULL
    ORDER BY embedding::vector <=> '${embeddingStr}'::vector
    LIMIT ${limit}
  `;

  const result = await sql.query(query, [type]);
  return result.rows;
}

// Initialize pgvector extension
export async function initializePgVector() {
  try {
    await sql.query('CREATE EXTENSION IF NOT EXISTS vector');
    console.log('pgvector extension enabled');
  } catch (error) {
    console.error('Error enabling pgvector:', error);
  }
}
