import { sql } from "drizzle-orm";
import { db } from "~/server/db/client";
import { places } from "~/server/db/schema";

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
      name: places.name,
      description: places.description,
      latitude: places.latitude,
      longitude: places.longitude,
      address: places.address,
      website: places.website,
      distance: distanceExpr,
      checkinCount: sql<number>`coalesce((
        SELECT count(*)::int FROM checkins c
        WHERE c.place_id = "places"."id"
      ), 0)`,
    })
    .from(places)
    .where(sql`${places.latitude} IS NOT NULL AND ${places.longitude} IS NOT NULL
      AND ${places.latitude}::double precision BETWEEN ${lat - latDelta} AND ${lat + latDelta}
      AND ${places.longitude}::double precision BETWEEN ${lng - lngDelta} AND ${lng + lngDelta}
      AND ${distanceExpr} <= ${radius}`)
    .orderBy(distanceExpr)
    .limit(50);

  return Response.json({ places: rows });
};
