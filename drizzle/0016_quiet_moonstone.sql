ALTER TABLE "places" DROP CONSTRAINT "places_category_id_place_categories_id_fk";--> statement-breakpoint
ALTER TABLE "place_categories" DROP CONSTRAINT "place_categories_parent_id_place_categories_id_fk";--> statement-breakpoint
ALTER TABLE "place_categories" DROP CONSTRAINT "place_categories_pkey";--> statement-breakpoint
ALTER TABLE "place_categories" DROP CONSTRAINT "place_categories_slug_unique";--> statement-breakpoint
ALTER TABLE "place_categories" RENAME COLUMN "parent_id" TO "parent_slug";--> statement-breakpoint
UPDATE "place_categories" AS child
SET "parent_slug" = parent."slug"
FROM "place_categories" AS parent
WHERE child."parent_slug" = parent."id";--> statement-breakpoint
UPDATE "places"
SET "category_id" = pc."slug"
FROM "place_categories" AS pc
WHERE "places"."category_id" = pc."id";--> statement-breakpoint
ALTER TABLE "place_categories" ADD PRIMARY KEY ("slug");--> statement-breakpoint
ALTER TABLE "place_categories" ADD CONSTRAINT "place_categories_parent_slug_place_categories_slug_fk" FOREIGN KEY ("parent_slug") REFERENCES "public"."place_categories"("slug") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "places" ADD CONSTRAINT "places_category_id_place_categories_slug_fk" FOREIGN KEY ("category_id") REFERENCES "public"."place_categories"("slug") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "place_categories" DROP COLUMN "id";
