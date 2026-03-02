CREATE TABLE "place_categories" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"slug" varchar(64) NOT NULL,
	"label" varchar(128) NOT NULL,
	"emoji" varchar(16) NOT NULL,
	"parent_id" varchar(64),
	"sort_order" integer DEFAULT 0 NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "place_categories_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "places" ADD COLUMN "category_id" varchar(64);
--> statement-breakpoint
ALTER TABLE "place_categories" ADD CONSTRAINT "place_categories_parent_id_place_categories_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."place_categories"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "places" ADD CONSTRAINT "places_category_id_place_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."place_categories"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
INSERT INTO "place_categories" ("id", "slug", "label", "emoji", "parent_id", "sort_order")
VALUES
	('food_drink', 'food-drink', 'Food & Drink', '🍽️', NULL, 0),
	('cafe', 'cafe', 'Cafe', '☕', 'food_drink', 0),
	('specialty_coffee', 'specialty-coffee', 'Specialty Coffee', '🫘', 'cafe', 0),
	('restaurant', 'restaurant', 'Restaurant', '🍜', 'food_drink', 1),
	('bar', 'bar', 'Bar', '🍺', 'food_drink', 2),
	('bakery', 'bakery', 'Bakery', '🥐', 'food_drink', 3),
	('arts_culture', 'arts-culture', 'Arts & Culture', '🎭', NULL, 1),
	('gallery', 'gallery', 'Gallery', '🖼️', 'arts_culture', 0),
	('museum', 'museum', 'Museum', '🏛️', 'arts_culture', 1),
	('theater', 'theater', 'Theater', '🎟️', 'arts_culture', 2),
	('library', 'library', 'Library', '📚', 'arts_culture', 3),
	('community_work', 'community-work', 'Community & Work', '🏘️', NULL, 2),
	('community_center', 'community-center', 'Community Center', '🏠', 'community_work', 0),
	('coworking', 'coworking', 'Coworking Space', '💼', 'community_work', 1),
	('meetup_space', 'meetup-space', 'Meetup Space', '💬', 'community_work', 2),
	('outdoors', 'outdoors', 'Outdoors', '🌳', NULL, 3),
	('park', 'park', 'Park', '🌿', 'outdoors', 0),
	('trail', 'trail', 'Trail', '🥾', 'outdoors', 1),
	('beach', 'beach', 'Beach', '🏖️', 'outdoors', 2),
	('shopping', 'shopping', 'Shopping', '🛍️', NULL, 4),
	('market', 'market', 'Market', '🛒', 'shopping', 0),
	('bookstore', 'bookstore', 'Bookstore', '📖', 'shopping', 1),
	('mall', 'mall', 'Mall', '🏬', 'shopping', 2),
	('education_making', 'education-making', 'Education & Making', '🎓', NULL, 5),
	('school', 'school', 'School', '🏫', 'education_making', 0),
	('workshop_space', 'workshop-space', 'Workshop Space', '🛠️', 'education_making', 1),
	('studio', 'studio', 'Studio', '🎙️', 'education_making', 2),
	('sports_wellness', 'sports-wellness', 'Sports & Wellness', '💪', NULL, 6),
	('gym', 'gym', 'Gym', '🏋️', 'sports_wellness', 0),
	('yoga_studio', 'yoga-studio', 'Yoga Studio', '🧘', 'sports_wellness', 1),
	('climbing_gym', 'climbing-gym', 'Climbing Gym', '🧗', 'sports_wellness', 2),
	('nightlife_fun', 'nightlife-fun', 'Nightlife & Fun', '🎉', NULL, 7),
	('club', 'club', 'Club', '💃', 'nightlife_fun', 0),
	('karaoke', 'karaoke', 'Karaoke', '🎤', 'nightlife_fun', 1),
	('arcade', 'arcade', 'Arcade', '🕹️', 'nightlife_fun', 2);
