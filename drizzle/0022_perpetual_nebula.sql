CREATE TABLE "user_fediverse_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"fediverse_handle" varchar(128) NOT NULL,
	"proxy_handle" varchar(128) NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_fediverse_accounts_fediverse_handle_unique" UNIQUE("fediverse_handle"),
	CONSTRAINT "user_fediverse_accounts_proxy_handle_unique" UNIQUE("proxy_handle")
);
--> statement-breakpoint
ALTER TABLE "users" DROP CONSTRAINT "users_fediverse_handle_unique";--> statement-breakpoint
ALTER TABLE "user_fediverse_accounts" ADD CONSTRAINT "user_fediverse_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
-- Data migration: copy existing users' fediverse handles as primary accounts
INSERT INTO user_fediverse_accounts (user_id, fediverse_handle, proxy_handle, is_primary)
SELECT id, fediverse_handle, handle, true FROM users WHERE fediverse_handle IS NOT NULL;--> statement-breakpoint
-- Partial unique index: ensure at most one primary account per user
CREATE UNIQUE INDEX idx_ufa_one_primary_per_user ON user_fediverse_accounts (user_id) WHERE is_primary = true;