CREATE TABLE "event_ticketing_settings" (
	"event_id" uuid PRIMARY KEY NOT NULL,
	"mode" varchar(32) NOT NULL,
	"provider" varchar(32),
	"provider_account_id" text,
	"currency" varchar(3),
	"enabled" boolean DEFAULT true NOT NULL,
	"legacy" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ticket_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reservation_id" uuid NOT NULL,
	"provider" varchar(32) NOT NULL,
	"provider_payment_id" text,
	"provider_tx_id" text,
	"checkout_id" text,
	"status" varchar(32) NOT NULL,
	"amount" integer NOT NULL,
	"currency" varchar(3) NOT NULL,
	"raw_event" jsonb,
	"paid_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ticket_reservations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"tier_id" uuid,
	"user_id" uuid,
	"token" varchar(64),
	"rsvp_id" uuid,
	"provider" varchar(32) NOT NULL,
	"provider_account_id" text,
	"amount" integer NOT NULL,
	"currency" varchar(3) NOT NULL,
	"status" varchar(32) NOT NULL,
	"checkout_id" text,
	"answers_snapshot" jsonb,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "event_ticketing_settings" ADD CONSTRAINT "event_ticketing_settings_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_payments" ADD CONSTRAINT "ticket_payments_reservation_id_ticket_reservations_id_fk" FOREIGN KEY ("reservation_id") REFERENCES "public"."ticket_reservations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_reservations" ADD CONSTRAINT "ticket_reservations_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_reservations" ADD CONSTRAINT "ticket_reservations_tier_id_event_tiers_id_fk" FOREIGN KEY ("tier_id") REFERENCES "public"."event_tiers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_reservations" ADD CONSTRAINT "ticket_reservations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_reservations" ADD CONSTRAINT "ticket_reservations_rsvp_id_rsvps_id_fk" FOREIGN KEY ("rsvp_id") REFERENCES "public"."rsvps"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
INSERT INTO "event_ticketing_settings" (
	"event_id",
	"mode",
	"provider",
	"provider_account_id",
	"currency",
	"enabled",
	"legacy",
	"created_at",
	"updated_at"
)
SELECT
	"events"."id",
	CASE
		WHEN "events"."external_url" IS NOT NULL AND "events"."external_url" <> '' THEN 'external'
		WHEN EXISTS (
			SELECT 1
			FROM "event_tiers"
			WHERE "event_tiers"."event_id" = "events"."id"
				AND COALESCE("event_tiers"."price_amount", 0) > 0
		) THEN 'paid'
		ELSE 'free'
	END,
	CASE
		WHEN EXISTS (
			SELECT 1
			FROM "event_tiers"
			WHERE "event_tiers"."event_id" = "events"."id"
				AND COALESCE("event_tiers"."price_amount", 0) > 0
		) THEN 'portone'
		ELSE NULL
	END,
	NULL,
	CASE
		WHEN EXISTS (
			SELECT 1
			FROM "event_tiers"
			WHERE "event_tiers"."event_id" = "events"."id"
				AND COALESCE("event_tiers"."price_amount", 0) > 0
		) THEN 'KRW'
		ELSE NULL
	END,
	CASE
		WHEN "events"."external_url" IS NOT NULL AND "events"."external_url" <> '' THEN true
		WHEN EXISTS (
			SELECT 1
			FROM "event_tiers"
			WHERE "event_tiers"."event_id" = "events"."id"
				AND COALESCE("event_tiers"."price_amount", 0) > 0
		) THEN false
		ELSE true
	END,
	true,
	now(),
	now()
FROM "events"
ON CONFLICT ("event_id") DO NOTHING;
