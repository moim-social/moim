ALTER TABLE "banners" ADD COLUMN "latitude" varchar(32);--> statement-breakpoint
ALTER TABLE "banners" ADD COLUMN "longitude" varchar(32);--> statement-breakpoint
ALTER TABLE "banners" ADD COLUMN "h3_index" varchar(15);--> statement-breakpoint
ALTER TABLE "banners" ADD COLUMN "hop_count" integer;