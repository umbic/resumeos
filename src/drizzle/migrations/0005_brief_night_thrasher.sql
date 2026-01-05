ALTER TABLE "content_items" ADD COLUMN "industry_tags" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "content_items" ADD COLUMN "base_id" text;--> statement-breakpoint
ALTER TABLE "content_items" ADD COLUMN "variant_label" text;--> statement-breakpoint
ALTER TABLE "content_items" ADD COLUMN "context" text;--> statement-breakpoint
ALTER TABLE "content_items" ADD COLUMN "method" text;--> statement-breakpoint
ALTER TABLE "content_items" ADD COLUMN "theme_tags" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "keyword_gaps" jsonb DEFAULT '[]'::jsonb;