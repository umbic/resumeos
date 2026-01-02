import { sql } from '@vercel/postgres';
import OpenAI from 'openai';
import contentDatabase from '../src/data/content-database.json';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface ContentItem {
  id: string;
  type: string;
  position: number | null;
  contentShort: string | null;
  contentMedium: string | null;
  contentLong: string | null;
  contentGeneric: string | null;
  brandTags: string[];
  categoryTags: string[];
  functionTags: string[];
  outcomeTags: string[];
  exclusiveMetrics: string[];
}

async function generateEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
  });
  return response.data[0].embedding;
}

function createEmbeddingText(item: ContentItem): string {
  const parts = [
    item.contentLong || item.contentMedium || item.contentShort,
    item.functionTags?.join(', '),
    item.outcomeTags?.join(', '),
    item.categoryTags?.join(', '),
  ].filter(Boolean);

  return parts.join(' | ');
}

async function createTables() {
  console.log('Creating pgvector extension...');
  await sql`CREATE EXTENSION IF NOT EXISTS vector`;

  console.log('Creating content_items table...');
  await sql`
    CREATE TABLE IF NOT EXISTS content_items (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      position INTEGER,
      content_short TEXT,
      content_medium TEXT,
      content_long TEXT,
      content_generic TEXT,
      brand_tags JSONB DEFAULT '[]',
      category_tags JSONB DEFAULT '[]',
      function_tags JSONB DEFAULT '[]',
      outcome_tags JSONB DEFAULT '[]',
      exclusive_metrics JSONB DEFAULT '[]',
      embedding vector(1536),
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;

  console.log('Creating conflict_rules table...');
  await sql`
    CREATE TABLE IF NOT EXISTS conflict_rules (
      id SERIAL PRIMARY KEY,
      item_id TEXT NOT NULL,
      conflicts_with JSONB NOT NULL,
      reason TEXT
    )
  `;

  console.log('Creating sessions table...');
  await sql`
    CREATE TABLE IF NOT EXISTS sessions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      job_description TEXT,
      target_title TEXT,
      target_company TEXT,
      industry TEXT,
      keywords JSONB DEFAULT '[]',
      themes JSONB DEFAULT '[]',
      jd_embedding vector(1536),
      used_content_ids JSONB DEFAULT '[]',
      blocked_content_ids JSONB DEFAULT '[]',
      approved_header JSONB,
      approved_summary TEXT,
      approved_highlights JSONB DEFAULT '[]',
      approved_positions JSONB,
      format TEXT DEFAULT 'long',
      branding_mode TEXT DEFAULT 'branded',
      current_step INTEGER DEFAULT 0,
      status TEXT DEFAULT 'active',
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `;

  console.log('Creating learned_content table...');
  await sql`
    CREATE TABLE IF NOT EXISTS learned_content (
      id TEXT PRIMARY KEY,
      base_id TEXT NOT NULL,
      type TEXT NOT NULL,
      context_tag TEXT,
      original_content TEXT,
      new_content TEXT,
      source_industry TEXT,
      times_reused INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;

  console.log('Creating embedding index...');
  await sql`
    CREATE INDEX IF NOT EXISTS content_embedding_idx
    ON content_items
    USING hnsw (embedding vector_cosine_ops)
  `;

  console.log('Tables created successfully!');
}

async function seedContentItems() {
  console.log(`\nSeeding ${contentDatabase.items.length} content items...`);

  // Clear existing data
  await sql`DELETE FROM content_items`;

  let count = 0;
  for (const item of contentDatabase.items) {
    const embeddingText = createEmbeddingText(item as ContentItem);
    console.log(`Generating embedding for ${item.id}...`);

    const embedding = await generateEmbedding(embeddingText);
    const embeddingStr = `[${embedding.join(',')}]`;

    await sql`
      INSERT INTO content_items (
        id, type, position,
        content_short, content_medium, content_long, content_generic,
        brand_tags, category_tags, function_tags, outcome_tags, exclusive_metrics,
        embedding
      ) VALUES (
        ${item.id},
        ${item.type},
        ${item.position},
        ${item.contentShort},
        ${item.contentMedium},
        ${item.contentLong},
        ${item.contentGeneric},
        ${JSON.stringify(item.brandTags || [])},
        ${JSON.stringify(item.categoryTags || [])},
        ${JSON.stringify(item.functionTags || [])},
        ${JSON.stringify(item.outcomeTags || [])},
        ${JSON.stringify(item.exclusiveMetrics || [])},
        ${embeddingStr}::vector
      )
    `;

    count++;
    if (count % 10 === 0) {
      console.log(`  Progress: ${count}/${contentDatabase.items.length}`);
    }

    // Rate limiting for OpenAI API
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  console.log(`Seeded ${count} content items!`);
}

async function seedConflictRules() {
  console.log('\nSeeding conflict rules...');

  // Clear existing data
  await sql`DELETE FROM conflict_rules`;

  for (const rule of contentDatabase.conflictRules) {
    await sql`
      INSERT INTO conflict_rules (item_id, conflicts_with, reason)
      VALUES (
        ${rule.itemId},
        ${JSON.stringify(rule.conflictsWith)},
        ${rule.reason}
      )
    `;
  }

  console.log(`Seeded ${contentDatabase.conflictRules.length} conflict rules!`);
}

async function main() {
  console.log('Starting database seeding...\n');

  try {
    await createTables();
    await seedContentItems();
    await seedConflictRules();

    console.log('\n✅ Database seeding completed successfully!');
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  }
}

main();
