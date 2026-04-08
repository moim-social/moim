import { eq } from "drizzle-orm";
import { db } from "~/server/db/client";
import { placeCategories, places } from "~/server/db/schema";
import { requireAdmin } from "~/server/admin";
import { generateAndUploadMapSnapshot } from "~/server/places/map-snapshot";

export const POST = async ({ request }: { request: Request }) => {
  await requireAdmin(request);

  const body = (await request.json().catch(() => null)) as { placeId?: string } | null;
  const placeId = body?.placeId?.trim();
  if (!placeId) {
    return Response.json({ error: "placeId is required" }, { status: 400 });
  }

  const [place] = await db
    .select({
      id: places.id,
      latitude: places.latitude,
      longitude: places.longitude,
      categoryEmoji: placeCategories.emoji,
    })
    .from(places)
    .leftJoin(placeCategories, eq(places.categoryId, placeCategories.slug))
    .where(eq(places.id, placeId))
    .limit(1);

  if (!place) {
    return Response.json({ error: "Place not found" }, { status: 404 });
  }
  if (!place.latitude || !place.longitude) {
    return Response.json({ error: "Place has no coordinates" }, { status: 400 });
  }

  const mapImageUrl = await generateAndUploadMapSnapshot(
    place.id,
    parseFloat(place.latitude),
    parseFloat(place.longitude),
    place.categoryEmoji,
  );

  return Response.json({ mapImageUrl });
};
