ALTER TABLE "actors" ALTER COLUMN "handle" SET DATA TYPE varchar(128);--> statement-breakpoint
ALTER TABLE "otp_challenges" ALTER COLUMN "handle" SET DATA TYPE varchar(128);--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "handle" SET DATA TYPE varchar(128);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "fediverse_handle" varchar(128);--> statement-breakpoint

-- Data migration: populate fediverse_handle from existing handle, then transform handle to proxy format
UPDATE "users" SET "fediverse_handle" = "handle" WHERE "fediverse_handle" IS NULL;--> statement-breakpoint
UPDATE "users" SET "handle" = REPLACE("handle", '@', '.') WHERE "handle" LIKE '%@%';--> statement-breakpoint

-- Update local Person actors to match new proxy handle format
-- In PostgreSQL, SET clause references use OLD column values, so "handle" here is the old value
UPDATE "actors" SET
  "handle" = REPLACE("handle", '@', '.'),
  "actor_url" = REPLACE("actor_url", "handle", REPLACE("handle", '@', '.')),
  "iri" = REPLACE("iri", "handle", REPLACE("handle", '@', '.')),
  "url" = REPLACE("url", "handle", REPLACE("handle", '@', '.')),
  "inbox_url" = REPLACE("inbox_url", "handle", REPLACE("handle", '@', '.')),
  "outbox_url" = REPLACE("outbox_url", "handle", REPLACE("handle", '@', '.')),
  "followers_url" = REPLACE("followers_url", "handle", REPLACE("handle", '@', '.')),
  "following_url" = REPLACE("following_url", "handle", REPLACE("handle", '@', '.'))
WHERE "type" = 'Person' AND "is_local" = true AND "handle" LIKE '%@%';--> statement-breakpoint

ALTER TABLE "users" ADD CONSTRAINT "users_fediverse_handle_unique" UNIQUE("fediverse_handle");
