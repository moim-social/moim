ALTER TABLE "event_organizers" DROP CONSTRAINT "event_organizers_event_id_actor_id_pk";--> statement-breakpoint
ALTER TABLE "event_organizers" ALTER COLUMN "actor_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "event_organizers" ADD COLUMN "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL;--> statement-breakpoint
ALTER TABLE "event_organizers" ADD COLUMN "name" varchar(200);--> statement-breakpoint
ALTER TABLE "event_organizers" ADD COLUMN "homepage_url" text;