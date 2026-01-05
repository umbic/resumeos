import { sql } from '@vercel/postgres';
import OpenAI from 'openai';
import contentDatabase from '../src/data/content-database.json';
import variantsDatabase from '../src/data/career-highlight-variants.json';

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

async function ensureSchema() {
  console.log('Ensuring pgvector extension...');
  await sql`CREATE EXTENSION IF NOT EXISTS vector`;

  // Tables are managed by Drizzle, so we just ensure new columns exist
  // Add any missing columns for variant system
  console.log('Ensuring variant columns exist...');

  const columns = [
    { name: 'industry_tags', sql: `ALTER TABLE content_items ADD COLUMN IF NOT EXISTS industry_tags JSONB DEFAULT '[]'` },
    { name: 'base_id', sql: `ALTER TABLE content_items ADD COLUMN IF NOT EXISTS base_id TEXT` },
    { name: 'variant_label', sql: `ALTER TABLE content_items ADD COLUMN IF NOT EXISTS variant_label TEXT` },
    { name: 'context', sql: `ALTER TABLE content_items ADD COLUMN IF NOT EXISTS context TEXT` },
    { name: 'method', sql: `ALTER TABLE content_items ADD COLUMN IF NOT EXISTS method TEXT` },
    { name: 'theme_tags', sql: `ALTER TABLE content_items ADD COLUMN IF NOT EXISTS theme_tags JSONB DEFAULT '[]'` },
  ];

  for (const col of columns) {
    try {
      await sql.query(col.sql);
      console.log(`  ✓ ${col.name}`);
    } catch (error: unknown) {
      // Column might already exist with different syntax - that's OK
      const message = error instanceof Error ? error.message : String(error);
      if (!message.includes('already exists')) {
        console.log(`  - ${col.name} (already exists or error)`);
      }
    }
  }

  console.log('Schema ready!');
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

interface BaseItem {
  id: string;
  client: string;
  generic_terms: string[];
  branded_by_default: boolean;
  industry_tags: string[];
  function_tags: string[];
  exclusive_metrics: string[];
  conflicts_with: string[];
}

interface Variant {
  id: string;
  base_id: string;
  variant_label: string;
  context: string;
  method: string;
  outcome: string;
  content: string;
  theme_tags: string[];
}

function createVariantEmbeddingText(variant: Variant): string {
  const parts = [
    variant.content,
    variant.theme_tags?.join(', '),
    variant.context,
  ].filter(Boolean);

  return parts.join(' | ');
}

async function updateBaseItemsWithMetadata() {
  console.log('\nUpdating base items with industry/function tags...');

  let count = 0;
  for (const baseItem of variantsDatabase.base_items as BaseItem[]) {
    // Check if base item exists in content_items
    const existing = await sql`
      SELECT id FROM content_items WHERE id = ${baseItem.id}
    `;

    if (existing.rows.length > 0) {
      // Update existing base item with new metadata
      await sql`
        UPDATE content_items
        SET
          industry_tags = ${JSON.stringify(baseItem.industry_tags)},
          function_tags = ${JSON.stringify(baseItem.function_tags)},
          exclusive_metrics = ${JSON.stringify(baseItem.exclusive_metrics)}
        WHERE id = ${baseItem.id}
      `;
      count++;
      console.log(`  Updated ${baseItem.id} with industry/function tags`);
    } else {
      console.log(`  Skipping ${baseItem.id} - not found in content_items`);
    }
  }

  console.log(`Updated ${count} base items with metadata!`);
}

async function seedVariants() {
  console.log(`\nSeeding ${variantsDatabase.variants.length} variants...`);

  // Delete existing variants (items with base_id set)
  await sql`DELETE FROM content_items WHERE base_id IS NOT NULL`;

  let count = 0;
  for (const variant of variantsDatabase.variants as Variant[]) {
    // Find the base item to get type and position
    const baseItem = variantsDatabase.base_items.find(b => b.id === variant.base_id) as BaseItem | undefined;

    // Determine type from base_id prefix
    let type = 'career_highlight';
    let position: number | null = null;

    if (variant.base_id.startsWith('P1-')) {
      type = 'bullet';
      position = 1;
    } else if (variant.base_id.startsWith('P2-')) {
      type = 'bullet';
      position = 2;
    }

    const embeddingText = createVariantEmbeddingText(variant);
    console.log(`Generating embedding for ${variant.id}...`);

    const embedding = await generateEmbedding(embeddingText);
    const embeddingStr = `[${embedding.join(',')}]`;

    await sql`
      INSERT INTO content_items (
        id, type, position,
        content_long,
        function_tags, industry_tags, exclusive_metrics,
        base_id, variant_label, context, method, theme_tags,
        embedding
      ) VALUES (
        ${variant.id},
        ${type},
        ${position},
        ${variant.content},
        ${JSON.stringify(baseItem?.function_tags || [])},
        ${JSON.stringify(baseItem?.industry_tags || [])},
        ${JSON.stringify(baseItem?.exclusive_metrics || [])},
        ${variant.base_id},
        ${variant.variant_label},
        ${variant.context},
        ${variant.method},
        ${JSON.stringify(variant.theme_tags || [])},
        ${embeddingStr}::vector
      )
    `;

    count++;
    if (count % 10 === 0) {
      console.log(`  Progress: ${count}/${variantsDatabase.variants.length}`);
    }

    // Rate limiting for OpenAI API
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  console.log(`Seeded ${count} variants!`);
}

async function main() {
  console.log('Starting database seeding...\n');

  try {
    await ensureSchema();
    await seedContentItems();
    await seedConflictRules();
    await updateBaseItemsWithMetadata();
    await seedVariants();

    console.log('\n✅ Database seeding completed successfully!');
    console.log(`   - ${contentDatabase.items.length} content items`);
    console.log(`   - ${contentDatabase.conflictRules.length} conflict rules`);
    console.log(`   - ${variantsDatabase.base_items.length} base items updated`);
    console.log(`   - ${variantsDatabase.variants.length} variants seeded`);
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  }
}

main();
