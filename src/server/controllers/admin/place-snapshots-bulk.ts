import { eq, isNotNull } from "drizzle-orm";
import { db } from "~/server/db/client";
import { placeCategories, places } from "~/server/db/schema";
import { requireAdmin } from "~/server/admin";
import { generateAndUploadMapSnapshot } from "~/server/places/map-snapshot";

export const POST = async ({ request }: { request: Request }) => {
  await requireAdmin(request);

  const allPlaces = await db
    .select({
      id: places.id,
      latitude: places.latitude,
      longitude: places.longitude,
      categoryEmoji: placeCategories.emoji,
    })
    .from(places)
    .leftJoin(placeCategories, eq(places.categoryId, placeCategories.slug))
    .where(isNotNull(places.latitude));

  let succeeded = 0;
  let failed = 0;

  for (const place of allPlaces) {
    if (!place.latitude || !place.longitude) continue;
    try {
      await generateAndUploadMapSnapshot(
        place.id,
        parseFloat(place.latitude),
        parseFloat(place.longitude),
        place.categoryEmoji,
      );
      succeeded++;
    } catch (err) {
      console.error(`Failed to regenerate snapshot for place ${place.id}:`, err);
      failed++;
    }
  }

  return Response.json({ total: allPlaces.length, succeeded, failed });
};
