import { and, eq, gte, sql } from "drizzle-orm";
import { db } from "~/server/db/client";
import { checkins, events, placeCategories, places, placeTags, tags, users } from "~/server/db/schema";
import { env } from "~/server/env";
import { getCategoryPath, getPlaceCategories } from "~/server/places/categories";

export const GET = async ({ request }: { request: Request }) => {
  const url = new URL(request.url);
  const placeId = url.searchParams.get("id");

  if (!placeId) {
    return Response.json({ error: "id is required" }, { status: 400 });
  }

  const [place] = await db
    .select({
      id: places.id,
      categoryId: places.categoryId,
      name: places.name,
      description: places.description,
      latitude: places.latitude,
      longitude: places.longitude,
      address: places.address,
      website: places.website,
      mapImageUrl: places.mapImageUrl,
      createdById: places.createdById,
      createdAt: places.createdAt,
      updatedAt: places.updatedAt,
      categoryLabel: placeCategories.label,
      categoryEmoji: placeCategories.emoji,
      categorySlug: placeCategories.slug,
      categoryEnabled: placeCategories.enabled,
    })
    .from(places)
    .leftJoin(placeCategories, eq(places.categoryId, placeCategories.id))
    .where(eq(places.id, placeId))
    .limit(1);

  if (!place) {
    return Response.json({ error: "Place not found" }, { status: 404 });
  }

  // Run independent queries in parallel
  const [placeTags_, recentCheckins, [checkinCountRow], upcomingEvents] =
    await Promise.all([
      db
        .select({
          slug: tags.slug,
          label: tags.label,
        })
        .from(placeTags)
        .innerJoin(tags, eq(tags.id, placeTags.tagId))
        .where(eq(placeTags.placeId, placeId)),
      db
        .select({
          id: checkins.id,
          note: checkins.note,
          createdAt: checkins.createdAt,
          userDisplayName: users.displayName,
          userHandle: users.fediverseHandle,
          userAvatarUrl: users.avatarUrl,
        })
        .from(checkins)
        .innerJoin(users, eq(checkins.userId, users.id))
        .where(eq(checkins.placeId, placeId))
        .orderBy(sql`${checkins.createdAt} DESC`)
        .limit(10),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(checkins)
        .where(eq(checkins.placeId, placeId)),
      db
        .select({
          id: events.id,
          title: events.title,
          startsAt: events.startsAt,
        })
        .from(events)
        .where(and(eq(events.placeId, placeId), gte(events.startsAt, new Date())))
        .orderBy(events.startsAt)
        .limit(5),
    ]);

  const categoryPath = place.categoryId
    ? getCategoryPath(place.categoryId, await getPlaceCategories(true)).map((row) => ({
        id: row.id,
        slug: row.slug,
        label: row.label,
        emoji: row.emoji,
        enabled: row.enabled,
      }))
    : [];

  return Response.json({
    place: {
      id: place.id,
      name: place.name,
      description: place.description,
      latitude: place.latitude,
      longitude: place.longitude,
      address: place.address,
      website: place.website,
      category: place.categoryId
        ? {
            id: place.categoryId,
            slug: place.categorySlug,
            label: place.categoryLabel,
            emoji: place.categoryEmoji,
            enabled: place.categoryEnabled,
          }
        : null,
    },
    categoryPath,
    tags: placeTags_,
    recentCheckins,
    checkinCount: checkinCountRow?.count ?? 0,
    upcomingEvents,
    mapLinkProviders: env.mapLinkProviders,
  });
};
