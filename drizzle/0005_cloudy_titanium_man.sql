CREATE TABLE "event_organizers" (
	"event_id" uuid NOT NULL,
	"actor_id" uuid NOT NULL,
	CONSTRAINT "event_organizers_event_id_actor_id_pk" PRIMARY KEY("event_id","actor_id")
);
--> statement-breakpoint
-- Clear events before adding NOT NULL column (no events exist yet)
DELETE FROM "event_tags" WHERE "event_id" IN (SELECT "id" FROM "events");--> statement-breakpoint
DELETE FROM "rsvps" WHERE "event_id" IN (SELECT "id" FROM "events");--> statement-breakpoint
DELETE FROM "events";--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "category_id" varchar(64) NOT NULL;--> statement-breakpoint
ALTER TABLE "event_organizers" ADD CONSTRAINT "event_organizers_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_organizers" ADD CONSTRAINT "event_organizers_actor_id_actors_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."actors"("id") ON DELETE no action ON UPDATE no action;