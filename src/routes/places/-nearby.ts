import { eq, sql } from "drizzle-orm";
import { db } from "~/server/db/client";
import { placeCategories, places } from "~/server/db/schema";

export const GET = async ({ request }: { request: Request }) => {
  const url = new URL(request.url);
  const lat = parseFloat(url.searchParams.get("lat") ?? "");
  const lng = parseFloat(url.searchParams.get("lng") ?? "");
  const radius = parseFloat(url.searchParams.get("radius") ?? "10"); // km

  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    return Response.json({ error: "lat and lng are required" }, { status: 400 });
  }

  // Bounding box pre-filter (cheap) before expensive Haversine
  const latDelta = radius / 111.0;
  const lngDelta = radius / (111.0 * Math.cos(lat * Math.PI / 180));

  // Haversine formula to calculate distance in km
  const distanceExpr = sql<number>`(
    6371 * acos(
      cos(radians(${lat})) * cos(radians(${places.latitude}::double precision))
      * cos(radians(${places.longitude}::double precision) - radians(${lng}))
      + sin(radians(${lat})) * sin(radians(${places.latitude}::double precision))
    )
  )`;

  const rows = await db
    .select({
      id: places.id,
      categoryId: places.categoryId,
      name: places.name,
      description: places.description,
      latitude: places.latitude,
      longitude: places.longitude,
      address: places.address,
      website: places.website,
      categoryLabel: placeCategories.label,
      categoryEmoji: placeCategories.emoji,
      distance: distanceExpr,
      checkinCount: sql<number>`coalesce((
        SELECT count(*)::int FROM checkins c
        WHERE c.place_id = "places"."id"
      ), 0)`,
      latestCheckinUserName: sql<string | null>`(
        SELECT u.display_name FROM checkins c
        JOIN users u ON c.user_id = u.id
        WHERE c.place_id = "places"."id"
        ORDER BY c.created_at DESC LIMIT 1
      )`,
      latestCheckinUserAvatar: sql<string | null>`(
        SELECT u.avatar_url FROM checkins c
        JOIN users u ON c.user_id = u.id
        WHERE c.place_id = "places"."id"
        ORDER BY c.created_at DESC LIMIT 1
      )`,
      latestCheckinAt: sql<string | null>`(
        SELECT c.created_at::text FROM checkins c
        WHERE c.place_id = "places"."id"
        ORDER BY c.created_at DESC LIMIT 1
      )`,
    })
    .from(places)
    .leftJoin(placeCategories, eq(places.categoryId, placeCategories.slug))
    .where(sql`${places.latitude} IS NOT NULL AND ${places.longitude} IS NOT NULL
      AND ${places.latitude}::double precision BETWEEN ${lat - latDelta} AND ${lat + latDelta}
      AND ${places.longitude}::double precision BETWEEN ${lng - lngDelta} AND ${lng + lngDelta}
      AND ${distanceExpr} <= ${radius}`)
    .orderBy(distanceExpr)
    .limit(50);

  return Response.json({
    places: rows.map((row) => ({
      ...row,
      category: row.categoryId
        ? {
            slug: row.categoryId,
            label: row.categoryLabel,
            emoji: row.categoryEmoji,
          }
        : null,
      latestCheckin: row.latestCheckinUserName
        ? {
            userDisplayName: row.latestCheckinUserName,
            userAvatarUrl: row.latestCheckinUserAvatar,
            createdAt: row.latestCheckinAt,
          }
        : null,
    })),
  });
};
