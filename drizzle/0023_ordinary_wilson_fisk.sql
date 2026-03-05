ALTER TABLE "group_members" ALTER COLUMN "role" SET DEFAULT 'owner';--> statement-breakpoint
-- Migrate existing 'host' roles to 'owner'
UPDATE "group_members" SET "role" = 'owner' WHERE "role" = 'host';