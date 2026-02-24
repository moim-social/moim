-- Clear ephemeral OTP challenges before adding NOT NULL columns
DELETE FROM "otp_challenges";--> statement-breakpoint
CREATE TABLE "otp_votes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"challenge_id" uuid NOT NULL,
	"emoji" varchar(8) NOT NULL,
	"voter_actor_url" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "otp_votes_challenge_id_emoji_unique" UNIQUE("challenge_id","emoji")
);
--> statement-breakpoint
ALTER TABLE "otp_challenges" ADD COLUMN "question_id" uuid DEFAULT gen_random_uuid() NOT NULL;--> statement-breakpoint
ALTER TABLE "otp_challenges" ADD COLUMN "expected_emojis" jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "otp_challenges" ADD COLUMN "actor_url" text NOT NULL;--> statement-breakpoint
ALTER TABLE "otp_votes" ADD CONSTRAINT "otp_votes_challenge_id_otp_challenges_id_fk" FOREIGN KEY ("challenge_id") REFERENCES "public"."otp_challenges"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "otp_challenges" DROP COLUMN "otp";--> statement-breakpoint
ALTER TABLE "otp_challenges" ADD CONSTRAINT "otp_challenges_question_id_unique" UNIQUE("question_id");