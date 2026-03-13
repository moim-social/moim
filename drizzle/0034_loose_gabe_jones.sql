ALTER TABLE "posts" ADD COLUMN "in_reply_to_post_id" uuid;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "thread_root_id" uuid;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "thread_status" varchar(32);--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "last_replied_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "visibility" varchar(32) DEFAULT 'public';--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_in_reply_to_post_id_posts_id_fk" FOREIGN KEY ("in_reply_to_post_id") REFERENCES "public"."posts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_thread_root_id_posts_id_fk" FOREIGN KEY ("thread_root_id") REFERENCES "public"."posts"("id") ON DELETE no action ON UPDATE no action;