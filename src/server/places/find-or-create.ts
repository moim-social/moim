import { sql } from "drizzle-orm";
import { db } from "~/server/db/client";
import { places } from "~/server/db/schema";

const NEARBY_THRESHOLD_KM = 0.1; // 100 meters

export async function findOrCreatePlace(opts: {
  latitude: number;
  longitude: number;
  name: string;
  createdById: string;
}): Promise<{
  id: string;
  name: string;
  latitude: string | null;
  longitude: string | null;
  created: boolean;
}> {
  const { latitude: lat, longitude: lng, name, createdById } = opts;

  const latDelta = NEARBY_THRESHOLD_KM / 111.0;
  const lngDelta =
    NEARBY_THRESHOLD_KM / (111.0 * Math.cos(lat * (Math.PI / 180)));

  const distanceExpr = sql<number>`(
    6371 * acos(
      cos(radians(${lat})) * cos(radians(${places.latitude}::double precision))
      * cos(radians(${places.longitude}::double precision) - radians(${lng}))
      + sin(radians(${lat})) * sin(radians(${places.latitude}::double precision))
    )
  )`;

  const [nearbyPlace] = await db
    .select({
      id: places.id,
      name: places.name,
      latitude: places.latitude,
      longitude: places.longitude,
    })
    .from(places)
    .where(
      sql`${places.latitude} IS NOT NULL AND ${places.longitude} IS NOT NULL
        AND ${places.latitude}::double precision BETWEEN ${lat - latDelta} AND ${lat + latDelta}
        AND ${places.longitude}::double precision BETWEEN ${lng - lngDelta} AND ${lng + lngDelta}
        AND ${distanceExpr} <= ${NEARBY_THRESHOLD_KM}`,
    )
    .orderBy(distanceExpr)
    .limit(1);

  if (nearbyPlace) {
    return { ...nearbyPlace, created: false };
  }

  const [newPlace] = await db
    .insert(places)
    .values({
      name: name.trim(),
      latitude: lat.toFixed(6),
      longitude: lng.toFixed(6),
      createdById,
    })
    .returning({
      id: places.id,
      name: places.name,
      latitude: places.latitude,
      longitude: places.longitude,
    });

  return { ...newPlace, created: true };
}
