CREATE TABLE "group_places" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_actor_id" uuid NOT NULL,
	"place_id" uuid NOT NULL,
	"assigned_by_user_id" uuid NOT NULL,
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "group_places_group_actor_id_place_id_unique" UNIQUE("group_actor_id","place_id")
);
--> statement-breakpoint
CREATE TABLE "place_audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"place_id" uuid NOT NULL,
	"group_actor_id" uuid,
	"user_id" uuid NOT NULL,
	"action" varchar(64) NOT NULL,
	"changes" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "group_places" ADD CONSTRAINT "group_places_group_actor_id_actors_id_fk" FOREIGN KEY ("group_actor_id") REFERENCES "public"."actors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_places" ADD CONSTRAINT "group_places_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_places" ADD CONSTRAINT "group_places_assigned_by_user_id_users_id_fk" FOREIGN KEY ("assigned_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "place_audit_log" ADD CONSTRAINT "place_audit_log_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "place_audit_log" ADD CONSTRAINT "place_audit_log_group_actor_id_actors_id_fk" FOREIGN KEY ("group_actor_id") REFERENCES "public"."actors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "place_audit_log" ADD CONSTRAINT "place_audit_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;