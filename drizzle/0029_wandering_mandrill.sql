ALTER TABLE "events" ADD COLUMN "country" varchar(2);--> statement-breakpoint
UPDATE "events" SET "country" = 'KR' WHERE "country" IS NULL;