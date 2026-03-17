ALTER TABLE "users" ADD COLUMN "calendar_token" varchar(64);--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_calendar_token_unique" UNIQUE("calendar_token");