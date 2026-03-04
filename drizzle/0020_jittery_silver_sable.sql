CREATE TABLE "activity_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" varchar(32) NOT NULL,
	"actor_id" uuid NOT NULL,
	"post_id" uuid NOT NULL,
	"event_id" uuid,
	"emoji" varchar(64),
	"content" text,
	"activity_url" text,
	"reply_post_id" uuid,
	"raw" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "activity_logs_actor_id_post_id_type_emoji_unique" UNIQUE("actor_id","post_id","type","emoji")
);
--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "in_reply_to" text;--> statement-breakpoint
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_actor_id_actors_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."actors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_reply_post_id_posts_id_fk" FOREIGN KEY ("reply_post_id") REFERENCES "public"."posts"("id") ON DELETE no action ON UPDATE no action;