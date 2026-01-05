import { sql } from '@vercel/postgres';
import OpenAI from 'openai';
import masterContent from '../src/data/master-content.json';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function generateEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
  });
  return response.data[0].embedding;
}

function createEmbeddingText(item: {
  contentLong?: string;
  industryTags?: string[];
  functionTags?: string[];
  themeTags?: string[];
}): string {
  const parts = [
    item.contentLong,
    item.industryTags?.join(', '),
    item.functionTags?.join(', '),
    item.themeTags?.join(', '),
  ].filter(Boolean);
  return parts.join(' | ');
}

async function ensureSchema() {
  console.log('Ensuring pgvector extension...');
  await sql`CREATE EXTENSION IF NOT EXISTS vector`;

  console.log('Ensuring columns exist...');
  const columns = [
    { name: 'title', sql: `ALTER TABLE content_items ADD COLUMN IF NOT EXISTS title TEXT` },
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
      const message = error instanceof Error ? error.message : String(error);
      if (!message.includes('already exists')) {
        console.log(`  - ${col.name} (exists)`);
      }
    }
  }
  console.log('Schema ready!');
}

async function seedSummaries() {
  console.log(`\nSeeding ${masterContent.summaries.length} summaries...`);

  for (const item of masterContent.summaries) {
    const embeddingText = createEmbeddingText(item);
    console.log(`  Generating embedding for ${item.id}...`);

    const embedding = await generateEmbedding(embeddingText);
    const embeddingStr = `[${embedding.join(',')}]`;

    await sql`
      INSERT INTO content_items (
        id, type, position, title,
        content_long,
        industry_tags, function_tags, theme_tags,
        embedding
      ) VALUES (
        ${item.id},
        'summary',
        ${null},
        ${item.title},
        ${item.contentLong},
        ${JSON.stringify(item.industryTags || [])},
        ${JSON.stringify(item.functionTags || [])},
        ${JSON.stringify(item.themeTags || [])},
        ${embeddingStr}::vector
      )
      ON CONFLICT (id) DO UPDATE SET
        title = EXCLUDED.title,
        content_long = EXCLUDED.content_long,
        industry_tags = EXCLUDED.industry_tags,
        function_tags = EXCLUDED.function_tags,
        theme_tags = EXCLUDED.theme_tags,
        embedding = EXCLUDED.embedding
    `;

    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  console.log(`Seeded ${masterContent.summaries.length} summaries!`);
}

async function seedCareerHighlights() {
  console.log(`\nSeeding ${masterContent.careerHighlights.length} career highlights...`);

  for (const item of masterContent.careerHighlights) {
    // Seed base item
    const embeddingText = createEmbeddingText(item);
    console.log(`  Generating embedding for ${item.id}...`);

    const embedding = await generateEmbedding(embeddingText);
    const embeddingStr = `[${embedding.join(',')}]`;

    await sql`
      INSERT INTO content_items (
        id, type, position, title,
        content_long,
        function_tags, industry_tags, exclusive_metrics,
        embedding
      ) VALUES (
        ${item.id},
        'career_highlight',
        ${null},
        ${item.title},
        ${item.contentLong},
        ${JSON.stringify(item.functionTags || [])},
        ${JSON.stringify(item.industryTags || [])},
        ${JSON.stringify(item.exclusiveMetrics || [])},
        ${embeddingStr}::vector
      )
      ON CONFLICT (id) DO UPDATE SET
        title = EXCLUDED.title,
        content_long = EXCLUDED.content_long,
        function_tags = EXCLUDED.function_tags,
        industry_tags = EXCLUDED.industry_tags,
        exclusive_metrics = EXCLUDED.exclusive_metrics,
        embedding = EXCLUDED.embedding
    `;

    await new Promise((resolve) => setTimeout(resolve, 100));

    // Seed variants
    for (const variant of item.variants || []) {
      const variantEmbeddingText = `${variant.content} | ${variant.themeTags?.join(', ')}`;
      console.log(`    Generating embedding for ${variant.id}...`);

      const variantEmbedding = await generateEmbedding(variantEmbeddingText);
      const variantEmbeddingStr = `[${variantEmbedding.join(',')}]`;

      await sql`
        INSERT INTO content_items (
          id, type, position,
          content_long,
          base_id, variant_label, theme_tags,
          function_tags, industry_tags,
          embedding
        ) VALUES (
          ${variant.id},
          'career_highlight',
          ${null},
          ${variant.content},
          ${item.id},
          ${variant.label},
          ${JSON.stringify(variant.themeTags || [])},
          ${JSON.stringify(item.functionTags || [])},
          ${JSON.stringify(item.industryTags || [])},
          ${variantEmbeddingStr}::vector
        )
        ON CONFLICT (id) DO UPDATE SET
          content_long = EXCLUDED.content_long,
          base_id = EXCLUDED.base_id,
          variant_label = EXCLUDED.variant_label,
          theme_tags = EXCLUDED.theme_tags,
          function_tags = EXCLUDED.function_tags,
          industry_tags = EXCLUDED.industry_tags,
          embedding = EXCLUDED.embedding
      `;

      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  console.log(`Seeded career highlights with variants!`);
}

async function seedOverviews() {
  console.log(`\nSeeding ${masterContent.overviews.length} overviews...`);

  for (const item of masterContent.overviews) {
    // Seed base item
    const embeddingText = createEmbeddingText(item);
    console.log(`  Generating embedding for ${item.id}...`);

    const embedding = await generateEmbedding(embeddingText);
    const embeddingStr = `[${embedding.join(',')}]`;

    await sql`
      INSERT INTO content_items (
        id, type, position, title,
        content_long,
        function_tags, industry_tags,
        embedding
      ) VALUES (
        ${item.id},
        'overview',
        ${item.position},
        ${item.title},
        ${item.contentLong},
        ${JSON.stringify(item.functionTags || [])},
        ${JSON.stringify(item.industryTags || [])},
        ${embeddingStr}::vector
      )
      ON CONFLICT (id) DO UPDATE SET
        title = EXCLUDED.title,
        position = EXCLUDED.position,
        content_long = EXCLUDED.content_long,
        function_tags = EXCLUDED.function_tags,
        industry_tags = EXCLUDED.industry_tags,
        embedding = EXCLUDED.embedding
    `;

    await new Promise((resolve) => setTimeout(resolve, 100));

    // Seed variants
    for (const variant of item.variants || []) {
      const variantEmbeddingText = `${item.contentLong} | ${variant.themeTags?.join(', ')}`;
      console.log(`    Generating embedding for ${variant.id}...`);

      const variantEmbedding = await generateEmbedding(variantEmbeddingText);
      const variantEmbeddingStr = `[${variantEmbedding.join(',')}]`;

      await sql`
        INSERT INTO content_items (
          id, type, position, title,
          content_long,
          base_id, variant_label, theme_tags,
          function_tags, industry_tags,
          embedding
        ) VALUES (
          ${variant.id},
          'overview',
          ${item.position},
          ${variant.title || null},
          ${item.contentLong},
          ${item.id},
          ${variant.id.split('-').pop()},
          ${JSON.stringify(variant.themeTags || [])},
          ${JSON.stringify(item.functionTags || [])},
          ${JSON.stringify(item.industryTags || [])},
          ${variantEmbeddingStr}::vector
        )
        ON CONFLICT (id) DO UPDATE SET
          title = EXCLUDED.title,
          position = EXCLUDED.position,
          content_long = EXCLUDED.content_long,
          base_id = EXCLUDED.base_id,
          variant_label = EXCLUDED.variant_label,
          theme_tags = EXCLUDED.theme_tags,
          function_tags = EXCLUDED.function_tags,
          industry_tags = EXCLUDED.industry_tags,
          embedding = EXCLUDED.embedding
      `;

      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  console.log(`Seeded overviews with variants!`);
}

async function seedPositionBullets() {
  console.log('\nSeeding position bullets...');

  for (const [posKey, bullets] of Object.entries(masterContent.positionBullets)) {
    const position = parseInt(posKey.replace('P', ''));
    console.log(`\n  Position ${position}: ${bullets.length} bullets`);

    for (const item of bullets) {
      // Seed base item
      const embeddingText = createEmbeddingText(item);
      console.log(`    Generating embedding for ${item.id}...`);

      const embedding = await generateEmbedding(embeddingText);
      const embeddingStr = `[${embedding.join(',')}]`;

      await sql`
        INSERT INTO content_items (
          id, type, position, title,
          content_long,
          function_tags, industry_tags, exclusive_metrics,
          embedding
        ) VALUES (
          ${item.id},
          'bullet',
          ${position},
          ${item.title},
          ${item.contentLong},
          ${JSON.stringify(item.functionTags || [])},
          ${JSON.stringify(item.industryTags || [])},
          ${JSON.stringify(item.exclusiveMetrics || [])},
          ${embeddingStr}::vector
        )
        ON CONFLICT (id) DO UPDATE SET
          title = EXCLUDED.title,
          position = EXCLUDED.position,
          content_long = EXCLUDED.content_long,
          function_tags = EXCLUDED.function_tags,
          industry_tags = EXCLUDED.industry_tags,
          exclusive_metrics = EXCLUDED.exclusive_metrics,
          embedding = EXCLUDED.embedding
      `;

      await new Promise((resolve) => setTimeout(resolve, 100));

      // Seed variants
      for (const variant of item.variants || []) {
        const variantContent = variant.contentLong || item.contentLong;
        const variantEmbeddingText = `${variantContent} | ${variant.themeTags?.join(', ')}`;
        console.log(`      Generating embedding for ${variant.id}...`);

        const variantEmbedding = await generateEmbedding(variantEmbeddingText);
        const variantEmbeddingStr = `[${variantEmbedding.join(',')}]`;

        await sql`
          INSERT INTO content_items (
            id, type, position,
            content_long,
            base_id, variant_label, theme_tags,
            function_tags, industry_tags, exclusive_metrics,
            embedding
          ) VALUES (
            ${variant.id},
            'bullet',
            ${position},
            ${variantContent},
            ${item.id},
            ${variant.label},
            ${JSON.stringify(variant.themeTags || [])},
            ${JSON.stringify(variant.functionTags || item.functionTags || [])},
            ${JSON.stringify(variant.industryTags || item.industryTags || [])},
            ${JSON.stringify(variant.exclusiveMetrics || item.exclusiveMetrics || [])},
            ${variantEmbeddingStr}::vector
          )
          ON CONFLICT (id) DO UPDATE SET
            content_long = EXCLUDED.content_long,
            base_id = EXCLUDED.base_id,
            variant_label = EXCLUDED.variant_label,
            theme_tags = EXCLUDED.theme_tags,
            function_tags = EXCLUDED.function_tags,
            industry_tags = EXCLUDED.industry_tags,
            exclusive_metrics = EXCLUDED.exclusive_metrics,
            embedding = EXCLUDED.embedding
        `;

        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }
  }
  console.log('\nSeeded all position bullets with variants!');
}

async function seedConflictRules() {
  console.log('\nSeeding conflict rules...');

  await sql`DELETE FROM conflict_rules`;

  for (const rule of masterContent.conflictRules) {
    await sql`
      INSERT INTO conflict_rules (item_id, conflicts_with, reason)
      VALUES (
        ${rule.itemId},
        ${JSON.stringify(rule.conflictsWith)},
        ${rule.reason}
      )
    `;
  }

  console.log(`Seeded ${masterContent.conflictRules.length} conflict rules!`);
}

async function main() {
  console.log('Starting database seeding from master-content.json...\n');

  try {
    await ensureSchema();
    await seedSummaries();
    await seedCareerHighlights();
    await seedOverviews();
    await seedPositionBullets();
    await seedConflictRules();

    // Count totals
    const summaries = masterContent.summaries.length;
    const chBase = masterContent.careerHighlights.length;
    const chVariants = masterContent.careerHighlights.reduce((sum, ch) => sum + (ch.variants?.length || 0), 0);
    const ovBase = masterContent.overviews.length;
    const ovVariants = masterContent.overviews.reduce((sum, ov) => sum + (ov.variants?.length || 0), 0);

    let bulletBase = 0;
    let bulletVariants = 0;
    for (const bullets of Object.values(masterContent.positionBullets)) {
      bulletBase += bullets.length;
      bulletVariants += bullets.reduce((sum, b) => sum + (b.variants?.length || 0), 0);
    }

    console.log('\n✅ Database seeding completed successfully!');
    console.log(`   - ${summaries} summaries`);
    console.log(`   - ${chBase} career highlights + ${chVariants} variants`);
    console.log(`   - ${ovBase} overviews + ${ovVariants} variants`);
    console.log(`   - ${bulletBase} bullets + ${bulletVariants} variants`);
    console.log(`   - ${masterContent.conflictRules.length} conflict rules`);
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  }
}

main();
