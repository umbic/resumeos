import { pgTable, text, integer, timestamp, jsonb, uuid, serial } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// Custom vector type for pgvector
// Note: Vercel Postgres supports pgvector - we'll handle vectors as text and cast in queries
export const contentItems = pgTable('content_items', {
  id: text('id').primaryKey(),
  type: text('type').notNull(), // "summary", "career_highlight", "bullet", "overview"
  position: integer('position'), // 1-6 for position-specific, NULL otherwise

  // Content versions
  contentShort: text('content_short'),
  contentMedium: text('content_medium'),
  contentLong: text('content_long'),
  contentGeneric: text('content_generic'),

  // Metadata tags (stored as JSON arrays)
  brandTags: jsonb('brand_tags').$type<string[]>().default([]),
  categoryTags: jsonb('category_tags').$type<string[]>().default([]),
  functionTags: jsonb('function_tags').$type<string[]>().default([]),
  outcomeTags: jsonb('outcome_tags').$type<string[]>().default([]),
  exclusiveMetrics: jsonb('exclusive_metrics').$type<string[]>().default([]),

  // Embedding stored as text, converted to vector in queries
  embedding: text('embedding'),

  createdAt: timestamp('created_at').defaultNow(),
});

export const conflictRules = pgTable('conflict_rules', {
  id: serial('id').primaryKey(),
  itemId: text('item_id').notNull(),
  conflictsWith: jsonb('conflicts_with').$type<string[]>().notNull(),
  reason: text('reason'),
});

export const sessions = pgTable('sessions', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),

  // JD Analysis
  jobDescription: text('job_description'),
  targetTitle: text('target_title'),
  targetCompany: text('target_company'),
  industry: text('industry'),
  keywords: jsonb('keywords').$type<string[]>().default([]),
  themes: jsonb('themes').$type<string[]>().default([]),
  jdEmbedding: text('jd_embedding'),

  // Content tracking
  usedContentIds: jsonb('used_content_ids').$type<string[]>().default([]),
  blockedContentIds: jsonb('blocked_content_ids').$type<string[]>().default([]),

  // Approved sections
  approvedHeader: jsonb('approved_header').$type<{
    name: string;
    title: string;
    location: string;
    phone: string;
    email: string;
  } | null>(),
  approvedSummary: text('approved_summary'),
  approvedHighlights: jsonb('approved_highlights').$type<string[]>().default([]),
  approvedPositions: jsonb('approved_positions').$type<{
    [key: number]: {
      title: string;
      company: string;
      location: string;
      dates: string;
      overview: string;
      bullets: string[];
    };
  }>(),

  // Settings
  format: text('format').default('long'), // "long" or "short"
  brandingMode: text('branding_mode').default('branded'), // "branded" or "generic"

  // State
  currentStep: integer('current_step').default(0),
  status: text('status').default('active'),

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const learnedContent = pgTable('learned_content', {
  id: text('id').primaryKey(),
  baseId: text('base_id').notNull(),
  type: text('type').notNull(),
  contextTag: text('context_tag'),
  originalContent: text('original_content'),
  newContent: text('new_content'),
  sourceIndustry: text('source_industry'),
  timesReused: integer('times_reused').default(0),
  createdAt: timestamp('created_at').defaultNow(),
});

// Types
export type ContentItem = typeof contentItems.$inferSelect;
export type NewContentItem = typeof contentItems.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
export type ConflictRule = typeof conflictRules.$inferSelect;
export type LearnedContent = typeof learnedContent.$inferSelect;
