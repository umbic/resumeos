import { pgTable, text, integer, timestamp, jsonb, uuid, serial } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import type { JDAnalysis, VerbTracker, GeneratedResume, Gap, QualityScore, RefinementMessage, KeywordGap } from '../types';

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
  industryTags: jsonb('industry_tags').$type<string[]>().default([]),

  // Variant system
  baseId: text('base_id'),              // e.g., "CH-01" for variant "CH-01-V1"
  variantLabel: text('variant_label'),  // e.g., "Team Leadership"
  context: text('context'),             // The situation/challenge
  method: text('method'),               // The approach taken
  themeTags: jsonb('theme_tags').$type<string[]>().default([]),  // Variant-specific emphasis tags

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

  // Session metadata
  name: text('name'), // User-provided session name (e.g., "Mastercard", "Anthropic GTM")

  // JD Analysis
  jobDescription: text('job_description'),
  targetTitle: text('target_title'),
  targetCompany: text('target_company'),
  industry: text('industry'),
  keywords: jsonb('keywords').$type<string[]>().default([]),
  themes: jsonb('themes').$type<string[]>().default([]),
  jdEmbedding: text('jd_embedding'),

  // Enhanced JD Analysis with ATS keywords
  jdAnalysis: jsonb('jd_analysis').$type<JDAnalysis | null>(),

  // Verb tracking for action verb variety
  verbTracker: jsonb('verb_tracker').$type<VerbTracker>().default({
    usedVerbs: {},
    availableVerbs: [
      'Built', 'Developed', 'Created', 'Established', 'Launched', 'Designed',
      'Led', 'Directed', 'Oversaw', 'Managed', 'Headed', 'Guided',
      'Grew', 'Scaled', 'Expanded', 'Increased', 'Accelerated', 'Drove',
      'Transformed', 'Repositioned', 'Modernized', 'Revitalized', 'Redesigned',
      'Architected', 'Defined', 'Shaped', 'Crafted', 'Pioneered', 'Championed',
      'Delivered', 'Executed', 'Implemented', 'Activated', 'Orchestrated'
    ]
  }),

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

  // V1.5 One-Shot Generation
  generatedResume: jsonb('generated_resume').$type<GeneratedResume>(),
  gaps: jsonb('gaps').$type<Gap[]>().default([]),
  keywordGaps: jsonb('keyword_gaps').$type<KeywordGap[]>().default([]),
  qualityScore: jsonb('quality_score').$type<QualityScore>(),
  usedVerbs: text('used_verbs').array().default([]),
  usedPhrases: text('used_phrases').array().default([]),
  generationVersion: text('generation_version').default('v1'), // 'v1' or 'v1.5'

  // Chat refinement history
  refinementHistory: jsonb('refinement_history').$type<RefinementMessage[]>().default([]),

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

// Diagnostics table for tracking all generation events
export const sessionDiagnostics = pgTable('session_diagnostics', {
  id: text('id').primaryKey(),
  sessionId: uuid('session_id').notNull().references(() => sessions.id),

  // Event identification
  step: text('step').notNull(), // 'jd_analysis', 'content_selection', 'rewrite', 'quality_check'
  substep: text('substep'), // Optional sub-step like 'scoring_ch', 'scoring_p1'

  // Timing
  startedAt: timestamp('started_at').notNull(),
  completedAt: timestamp('completed_at'),
  durationMs: integer('duration_ms'),

  // Input/Output
  promptSent: text('prompt_sent'), // Full prompt verbatim
  responseReceived: text('response_received'), // Full response verbatim

  // Structured data (for non-LLM steps)
  inputData: jsonb('input_data'), // Input to this step
  outputData: jsonb('output_data'), // Output from this step

  // Decisions and reasoning
  decisions: jsonb('decisions').$type<{ decision: string; reason: string; data?: unknown }[]>(),

  // Metrics
  tokensSent: integer('tokens_sent'),
  tokensReceived: integer('tokens_received'),
  estimatedCost: integer('estimated_cost'), // Stored as microdollars (cost * 1_000_000)

  // Status
  status: text('status').notNull().default('pending'), // 'pending', 'success', 'error'
  errorMessage: text('error_message'),

  createdAt: timestamp('created_at').defaultNow(),
});

// Types
export type ContentItem = typeof contentItems.$inferSelect;
export type NewContentItem = typeof contentItems.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
export type ConflictRule = typeof conflictRules.$inferSelect;
export type LearnedContent = typeof learnedContent.$inferSelect;
export type SessionDiagnostic = typeof sessionDiagnostics.$inferSelect;
export type NewSessionDiagnostic = typeof sessionDiagnostics.$inferInsert;
