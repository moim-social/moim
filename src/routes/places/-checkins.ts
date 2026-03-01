import { eq, sql } from "drizzle-orm";
import { db } from "~/server/db/client";
import { checkins, users, places } from "~/server/db/schema";

export const GET = async ({ request }: { request: Request }) => {
  const url = new URL(request.url);
  const placeId = url.searchParams.get("placeId");
  const userId = url.searchParams.get("userId");
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "20", 10), 100);
  const offset = parseInt(url.searchParams.get("offset") ?? "0", 10);

  let query = db
    .select({
      id: checkins.id,
      note: checkins.note,
      createdAt: checkins.createdAt,
      placeName: places.name,
      placeId: checkins.placeId,
      userDisplayName: users.displayName,
      userHandle: users.fediverseHandle,
      userAvatarUrl: users.avatarUrl,
    })
    .from(checkins)
    .innerJoin(users, eq(checkins.userId, users.id))
    .innerJoin(places, eq(checkins.placeId, places.id))
    .$dynamic();

  if (placeId) {
    query = query.where(eq(checkins.placeId, placeId));
  } else if (userId) {
    query = query.where(eq(checkins.userId, userId));
  }

  // Run data and count queries in parallel
  let countQuery = db
    .select({ total: sql<number>`count(*)::int` })
    .from(checkins)
    .$dynamic();

  if (placeId) {
    countQuery = countQuery.where(eq(checkins.placeId, placeId));
  } else if (userId) {
    countQuery = countQuery.where(eq(checkins.userId, userId));
  }

  const [rows, [countRow]] = await Promise.all([
    query
      .orderBy(sql`${checkins.createdAt} DESC`)
      .limit(limit)
      .offset(offset),
    countQuery,
  ]);

  return Response.json({
    checkins: rows,
    total: countRow?.total ?? 0,
  });
};
