import { eq, and, sql, gte, lt } from "drizzle-orm";
import { db } from "~/server/db/client";
import { actors, groupMembers, events, follows } from "~/server/db/schema";
import { getSessionUser } from "~/server/auth";

export const GET = async ({ request }: { request: Request }) => {
  const user = await getSessionUser(request);
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Find the user's Person actor
  const [personActor] = await db
    .select({ id: actors.id })
    .from(actors)
    .where(eq(actors.userId, user.id))
    .limit(1);

  if (!personActor) {
    return Response.json({ groups: [] });
  }

  // Find all groups where the user is host or moderator
  const rows = await db
    .select({
      id: actors.id,
      handle: actors.handle,
      name: actors.name,
      summary: actors.summary,
      categories: actors.categories,
      role: groupMembers.role,
    })
    .from(groupMembers)
    .innerJoin(actors, eq(groupMembers.groupActorId, actors.id))
    .where(eq(groupMembers.memberActorId, personActor.id));

  const now = new Date();

  // Enrich each group with counts
  const groups = await Promise.all(
    rows.map(async (row) => {
      const [followerCount] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(follows)
        .where(and(eq(follows.followingId, row.id), eq(follows.status, "accepted")));

      const [memberCount] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(groupMembers)
        .where(eq(groupMembers.groupActorId, row.id));

      const [upcomingCount] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(events)
        .where(and(eq(events.groupActorId, row.id), gte(events.startsAt, now)));

      const [pastCount] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(events)
        .where(and(eq(events.groupActorId, row.id), lt(events.startsAt, now)));

      return {
        id: row.id,
        handle: row.handle,
        name: row.name,
        summary: row.summary,
        categories: row.categories,
        role: row.role,
        followersCount: followerCount.count,
        membersCount: memberCount.count,
        upcomingEventsCount: upcomingCount.count,
        pastEventsCount: pastCount.count,
      };
    }),
  );

  return Response.json({ groups });
};
