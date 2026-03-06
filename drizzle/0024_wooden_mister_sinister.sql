ALTER TABLE "actors" ADD COLUMN "timezone" varchar(64);--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "timezone" varchar(64);--> statement-breakpoint

-- Backfill: Change 'UTC' below to your instance's default timezone (e.g. 'Asia/Seoul')
-- before running this migration.

-- Backfill: set timezone on local group actors
UPDATE "actors" SET "timezone" = 'UTC'
WHERE "type" = 'Group' AND "is_local" = true AND "timezone" IS NULL;--> statement-breakpoint

-- Backfill: set timezone on events from their group actor's timezone
UPDATE "events" SET "timezone" = "actors"."timezone"
FROM "actors"
WHERE "events"."group_actor_id" = "actors"."id" AND "events"."timezone" IS NULL AND "actors"."timezone" IS NOT NULL;--> statement-breakpoint

-- Backfill: set timezone on remaining events (personal)
UPDATE "events" SET "timezone" = 'UTC'
WHERE "timezone" IS NULL;