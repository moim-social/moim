CREATE TABLE "event_categories" (
	"slug" varchar(64) PRIMARY KEY NOT NULL,
	"label" varchar(128) NOT NULL,
	"emoji" varchar(16),
	"description" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
INSERT INTO "event_categories" ("slug", "label", "sort_order") VALUES
  ('arts', 'Arts', 0),
  ('book_clubs', 'Book Clubs', 1),
  ('business', 'Business', 2),
  ('causes', 'Causes', 3),
  ('comedy', 'Comedy', 4),
  ('crafts', 'Crafts', 5),
  ('food_drink', 'Food & Drink', 6),
  ('health', 'Health', 7),
  ('music', 'Music', 8),
  ('auto_boat_air', 'Auto, Boat & Air', 9),
  ('community', 'Community', 10),
  ('family_education', 'Family & Education', 11),
  ('fashion_beauty', 'Fashion & Beauty', 12),
  ('film_media', 'Film & Media', 13),
  ('games', 'Games', 14),
  ('language_culture', 'Language & Culture', 15),
  ('learning', 'Learning', 16),
  ('lgbtq', 'LGBTQ', 17),
  ('movements_politics', 'Movements & Politics', 18),
  ('networking', 'Networking', 19),
  ('party', 'Party', 20),
  ('performing_visual_arts', 'Performing & Visual Arts', 21),
  ('pets', 'Pets', 22),
  ('photography', 'Photography', 23),
  ('outdoors_adventure', 'Outdoors & Adventure', 24),
  ('spirituality_religion_beliefs', 'Spirituality, Religion & Beliefs', 25),
  ('science_tech', 'Science & Tech', 26),
  ('sports', 'Sports', 27),
  ('theatre', 'Theatre', 28),
  ('meeting', 'Meeting', 29),
  ('programming', 'Programming', 30)
ON CONFLICT ("slug") DO NOTHING;
--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_category_id_event_categories_slug_fk" FOREIGN KEY ("category_id") REFERENCES "public"."event_categories"("slug") ON DELETE no action ON UPDATE no action;