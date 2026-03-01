ALTER TABLE "events" ALTER COLUMN "external_url" SET DEFAULT '';--> statement-breakpoint
ALTER TABLE "events" ALTER COLUMN "external_url" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "places" ADD COLUMN "website" text;--> statement-breakpoint
ALTER TABLE "places" ADD COLUMN "created_by_id" uuid;--> statement-breakpoint
ALTER TABLE "places" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "places" ADD CONSTRAINT "places_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;