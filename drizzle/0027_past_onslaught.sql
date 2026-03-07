ALTER TABLE "events" ADD COLUMN "published" boolean DEFAULT false NOT NULL;
UPDATE "events" SET "published" = true;