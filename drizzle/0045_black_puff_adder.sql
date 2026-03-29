ALTER TABLE "place_categories" ALTER COLUMN "labels" SET DEFAULT '{}'::jsonb;--> statement-breakpoint
ALTER TABLE "place_categories" ALTER COLUMN "labels" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "event_categories" ADD COLUMN "labels" jsonb DEFAULT '{}'::jsonb NOT NULL;