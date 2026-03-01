import { and, eq, gte, sql } from "drizzle-orm";
import { db } from "~/server/db/client";
import { places, placeTags, tags, checkins, users, events } from "~/server/db/schema";

export const GET = async ({ request }: { request: Request }) => {
  const url = new URL(request.url);
  const placeId = url.searchParams.get("id");

  if (!placeId) {
    return Response.json({ error: "id is required" }, { status: 400 });
  }

  const [place] = await db
    .select()
    .from(places)
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

  return Response.json({
    place,
    tags: placeTags_,
    recentCheckins,
    checkinCount: checkinCountRow?.count ?? 0,
    upcomingEvents,
  });
};
