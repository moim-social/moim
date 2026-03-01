import { and, eq, ilike, sql, type SQL } from "drizzle-orm";
import { db } from "~/server/db/client";
import { places, placeTags, tags } from "~/server/db/schema";

export const GET = async ({ request }: { request: Request }) => {
  const url = new URL(request.url);
  const query = url.searchParams.get("q");
  const tag = url.searchParams.get("tag");
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "50", 10), 100);
  const offset = parseInt(url.searchParams.get("offset") ?? "0", 10);

  let baseQuery = db
    .select({
      id: places.id,
      name: places.name,
      description: places.description,
      latitude: places.latitude,
      longitude: places.longitude,
      address: places.address,
      website: places.website,
      createdAt: places.createdAt,
      checkinCount: sql<number>`coalesce((
        SELECT count(*)::int FROM checkins c
        WHERE c.place_id = "places"."id"
      ), 0)`,
    })
    .from(places)
    .$dynamic();

  const conditions: SQL[] = [];

  if (query) {
    const escaped = query.replace(/[%_\\]/g, "\\$&");
    conditions.push(ilike(places.name, `%${escaped}%`));
  }

  if (tag) {
    baseQuery = baseQuery
      .innerJoin(placeTags, eq(placeTags.placeId, places.id))
      .innerJoin(tags, eq(tags.id, placeTags.tagId));
    conditions.push(eq(tags.slug, tag));
  }

  if (conditions.length > 0) {
    baseQuery = baseQuery.where(and(...conditions));
  }

  const rows = await baseQuery
    .orderBy(sql`${places.createdAt} DESC`)
    .limit(limit)
    .offset(offset);

  // Fetch tags for all returned places
  const placeIds = rows.map((r) => r.id);
  const tagRows = placeIds.length > 0
    ? await db
        .select({
          placeId: placeTags.placeId,
          tagSlug: tags.slug,
          tagLabel: tags.label,
        })
        .from(placeTags)
        .innerJoin(tags, eq(tags.id, placeTags.tagId))
        .where(sql`${placeTags.placeId} IN (${sql.join(placeIds.map((id) => sql`${id}`), sql`, `)})`)
    : [];

  const tagsByPlace = new Map<string, Array<{ slug: string; label: string }>>();
  for (const row of tagRows) {
    const existing = tagsByPlace.get(row.placeId) ?? [];
    existing.push({ slug: row.tagSlug, label: row.tagLabel });
    tagsByPlace.set(row.placeId, existing);
  }

  const result = rows.map((place) => ({
    ...place,
    tags: tagsByPlace.get(place.id) ?? [],
  }));

  return Response.json({ places: result });
};
