CREATE TABLE "conflict_rules" (
	"id" serial PRIMARY KEY NOT NULL,
	"item_id" text NOT NULL,
	"conflicts_with" jsonb NOT NULL,
	"reason" text
);
--> statement-breakpoint
CREATE TABLE "content_items" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"position" integer,
	"content_short" text,
	"content_medium" text,
	"content_long" text,
	"content_generic" text,
	"brand_tags" jsonb DEFAULT '[]'::jsonb,
	"category_tags" jsonb DEFAULT '[]'::jsonb,
	"function_tags" jsonb DEFAULT '[]'::jsonb,
	"outcome_tags" jsonb DEFAULT '[]'::jsonb,
	"exclusive_metrics" jsonb DEFAULT '[]'::jsonb,
	"embedding" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "learned_content" (
	"id" text PRIMARY KEY NOT NULL,
	"base_id" text NOT NULL,
	"type" text NOT NULL,
	"context_tag" text,
	"original_content" text,
	"new_content" text,
	"source_industry" text,
	"times_reused" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_description" text,
	"target_title" text,
	"target_company" text,
	"industry" text,
	"keywords" jsonb DEFAULT '[]'::jsonb,
	"themes" jsonb DEFAULT '[]'::jsonb,
	"jd_embedding" text,
	"jd_analysis" jsonb,
	"used_content_ids" jsonb DEFAULT '[]'::jsonb,
	"blocked_content_ids" jsonb DEFAULT '[]'::jsonb,
	"approved_header" jsonb,
	"approved_summary" text,
	"approved_highlights" jsonb DEFAULT '[]'::jsonb,
	"approved_positions" jsonb,
	"format" text DEFAULT 'long',
	"branding_mode" text DEFAULT 'branded',
	"current_step" integer DEFAULT 0,
	"status" text DEFAULT 'active',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
