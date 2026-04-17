ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "event_type" varchar(16) DEFAULT 'in_person' NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "meeting_url" text;