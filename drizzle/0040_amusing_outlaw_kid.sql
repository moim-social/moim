-- Phase 1: rsvps PK swap (composite → UUID)
-- Adding column with DEFAULT gen_random_uuid() backfills existing rows automatically
ALTER TABLE "rsvps" ADD COLUMN "id" uuid DEFAULT gen_random_uuid() NOT NULL;--> statement-breakpoint
ALTER TABLE "rsvps" DROP CONSTRAINT "rsvps_user_id_event_id_pk";--> statement-breakpoint
ALTER TABLE "rsvps" ADD PRIMARY KEY ("id");--> statement-breakpoint

-- Phase 2: Make rsvps.userId nullable + add anonymous columns
ALTER TABLE "rsvps" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "rsvps" ADD COLUMN "token" varchar(64);--> statement-breakpoint
ALTER TABLE "rsvps" ADD COLUMN "display_name" varchar(200);--> statement-breakpoint
ALTER TABLE "rsvps" ADD COLUMN "email" varchar(256);--> statement-breakpoint
ALTER TABLE "rsvps" ADD COLUMN "phone" varchar(64);--> statement-breakpoint

-- Phase 3: Partial unique indexes (one RSVP per user per event, one per token per event)
CREATE UNIQUE INDEX "rsvps_user_event_unique" ON "rsvps" ("user_id", "event_id") WHERE "user_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "rsvps_token_event_unique" ON "rsvps" ("token", "event_id") WHERE "token" IS NOT NULL;--> statement-breakpoint

-- Phase 4: CHECK constraint — every RSVP must have either a user or a token
ALTER TABLE "rsvps" ADD CONSTRAINT "rsvps_identity_check" CHECK ("user_id" IS NOT NULL OR "token" IS NOT NULL);--> statement-breakpoint

-- Phase 5: rsvp_answers — add rsvpId FK, backfill, then enforce NOT NULL
ALTER TABLE "rsvp_answers" DROP CONSTRAINT "rsvp_answers_user_id_event_id_question_id_unique";--> statement-breakpoint
ALTER TABLE "rsvp_answers" ADD COLUMN "rsvp_id" uuid;--> statement-breakpoint
UPDATE "rsvp_answers" a SET "rsvp_id" = r."id" FROM "rsvps" r WHERE r."user_id" = a."user_id" AND r."event_id" = a."event_id";--> statement-breakpoint
ALTER TABLE "rsvp_answers" ALTER COLUMN "rsvp_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "rsvp_answers" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "rsvp_answers" ADD CONSTRAINT "rsvp_answers_rsvp_id_rsvps_id_fk" FOREIGN KEY ("rsvp_id") REFERENCES "public"."rsvps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rsvp_answers" ADD CONSTRAINT "rsvp_answers_rsvp_id_question_id_unique" UNIQUE("rsvp_id","question_id");--> statement-breakpoint

-- Phase 6: events — add anonymous RSVP config columns
ALTER TABLE "events" ADD COLUMN "allow_anonymous_rsvp" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "anonymous_contact_fields" jsonb;
