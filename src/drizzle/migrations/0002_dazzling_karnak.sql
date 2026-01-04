ALTER TABLE "sessions" ADD COLUMN "generated_resume" jsonb;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "gaps" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "quality_score" jsonb;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "used_verbs" text[] DEFAULT '{}';--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "used_phrases" text[] DEFAULT '{}';--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "generation_version" text DEFAULT 'v1';