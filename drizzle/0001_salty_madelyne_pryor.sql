CREATE TABLE "follows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"follower_id" uuid NOT NULL,
	"following_id" uuid NOT NULL,
	"status" varchar(32) DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"accepted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "keypairs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"algorithm" varchar(32) NOT NULL,
	"public_key" text NOT NULL,
	"private_key" text NOT NULL,
	"actor_id" uuid NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "actors" ADD COLUMN "type" varchar(32) DEFAULT 'Person' NOT NULL;--> statement-breakpoint
ALTER TABLE "actors" ADD COLUMN "iri" text;--> statement-breakpoint
ALTER TABLE "actors" ADD COLUMN "url" text;--> statement-breakpoint
ALTER TABLE "actors" ADD COLUMN "name" text;--> statement-breakpoint
ALTER TABLE "actors" ADD COLUMN "summary" text;--> statement-breakpoint
ALTER TABLE "actors" ADD COLUMN "shared_inbox_url" text;--> statement-breakpoint
ALTER TABLE "actors" ADD COLUMN "followers_url" text;--> statement-breakpoint
ALTER TABLE "actors" ADD COLUMN "following_url" text;--> statement-breakpoint
ALTER TABLE "actors" ADD COLUMN "domain" text;--> statement-breakpoint
ALTER TABLE "actors" ADD COLUMN "manually_approves_followers" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "actors" ADD COLUMN "followers_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "actors" ADD COLUMN "following_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "actors" ADD COLUMN "user_id" uuid;--> statement-breakpoint
ALTER TABLE "actors" ADD COLUMN "event_id" uuid;--> statement-breakpoint
ALTER TABLE "actors" ADD COLUMN "last_fetched_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "actors" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "follows" ADD CONSTRAINT "follows_follower_id_actors_id_fk" FOREIGN KEY ("follower_id") REFERENCES "public"."actors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follows" ADD CONSTRAINT "follows_following_id_actors_id_fk" FOREIGN KEY ("following_id") REFERENCES "public"."actors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "keypairs" ADD CONSTRAINT "keypairs_actor_id_actors_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."actors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "actors" ADD CONSTRAINT "actors_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "actors" ADD CONSTRAINT "actors_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "actors" DROP COLUMN "public_key_pem";--> statement-breakpoint
ALTER TABLE "actors" DROP COLUMN "private_key_pem";