CREATE TABLE "event_tiers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"opens_at" timestamp with time zone,
	"closes_at" timestamp with time zone,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "event_tiers" ADD CONSTRAINT "event_tiers_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint

-- Backfill: create a default "General" tier for every existing event
INSERT INTO "event_tiers" ("event_id", "name", "sort_order")
SELECT "id", 'General', 0 FROM "events";--> statement-breakpoint

ALTER TABLE "rsvps" ADD COLUMN "tier_id" uuid;--> statement-breakpoint
ALTER TABLE "rsvps" ADD CONSTRAINT "rsvps_tier_id_event_tiers_id_fk" FOREIGN KEY ("tier_id") REFERENCES "public"."event_tiers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint

-- Backfill: point existing RSVPs to their event's default tier
UPDATE "rsvps" SET "tier_id" = "event_tiers"."id"
FROM "event_tiers"
WHERE "rsvps"."event_id" = "event_tiers"."event_id";