import { desc, eq, sql } from "drizzle-orm";
import { db } from "~/server/db/client";
import {
  users,
  sessions,
  actors,
  groupMembers,
  events,
  checkins,
  places,
} from "~/server/db/schema";
import { requireAdmin } from "~/server/admin";

export const GET = async ({ request }: { request: Request }) => {
  await requireAdmin(request);
  const url = new URL(request.url);
  const userId = url.searchParams.get("id");

  if (!userId) {
    return Response.json({ error: "id is required" }, { status: 400 });
  }

  const [userRow] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!userRow) {
    return Response.json({ error: "User not found" }, { status: 404 });
  }

  const [userSessions, userGroups, userEvents, userCheckins, [sessionCountRow]] =
    await Promise.all([
      // Active sessions
      db
        .select({
          id: sessions.id,
          createdAt: sessions.createdAt,
          expiresAt: sessions.expiresAt,
        })
        .from(sessions)
        .where(eq(sessions.userId, userId))
        .orderBy(desc(sessions.createdAt))
        .limit(50),

      // Group memberships via actor
      db
        .select({
          groupActorId: actors.id,
          groupName: actors.name,
          groupHandle: actors.handle,
          role: groupMembers.role,
          joinedAt: groupMembers.createdAt,
        })
        .from(groupMembers)
        .innerJoin(actors, eq(groupMembers.groupActorId, actors.id))
        .where(
          sql`${groupMembers.memberActorId} IN (
            SELECT id FROM actors WHERE user_id = ${userId}
          )`,
        )
        .orderBy(desc(groupMembers.createdAt)),

      // Events organized
      db
        .select({
          id: events.id,
          title: events.title,
          startsAt: events.startsAt,
          endsAt: events.endsAt,
          groupName: actors.name,
        })
        .from(events)
        .leftJoin(actors, eq(events.groupActorId, actors.id))
        .where(eq(events.organizerId, userId))
        .orderBy(desc(events.startsAt))
        .limit(50),

      // Recent check-ins
      db
        .select({
          id: checkins.id,
          placeName: places.name,
          placeId: checkins.placeId,
          note: checkins.note,
          createdAt: checkins.createdAt,
        })
        .from(checkins)
        .innerJoin(places, eq(checkins.placeId, places.id))
        .where(eq(checkins.userId, userId))
        .orderBy(desc(checkins.createdAt))
        .limit(50),

      // Session count
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(sessions)
        .where(eq(sessions.userId, userId)),
    ]);

  return Response.json({
    user: userRow,
    sessions: userSessions,
    groups: userGroups,
    events: userEvents,
    checkins: userCheckins,
    sessionCount: sessionCountRow?.count ?? 0,
  });
};
