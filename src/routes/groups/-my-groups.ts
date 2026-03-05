import { aliasedTable, eq, and, sql, gte, lt } from "drizzle-orm";
import { db } from "~/server/db/client";
import { actors, groupMembers, events, follows } from "~/server/db/schema";
import { getSessionUser } from "~/server/auth";

export const GET = async ({ request }: { request: Request }) => {
  const user = await getSessionUser(request);
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Find all groups where the user is host or moderator (join through actors to match any actor for this user)
  // A user may have multiple actors in the same group (from linked accounts), so deduplicate by group.
  const memberActors = aliasedTable(actors, "member_actors");
  const rawRows = await db
    .select({
      id: actors.id,
      handle: actors.handle,
      name: actors.name,
      summary: actors.summary,
      categories: actors.categories,
      language: actors.language,
      avatarUrl: actors.avatarUrl,
      role: groupMembers.role,
    })
    .from(groupMembers)
    .innerJoin(actors, eq(groupMembers.groupActorId, actors.id))
    .innerJoin(memberActors, eq(groupMembers.memberActorId, memberActors.id))
    .where(and(eq(memberActors.userId, user.id), eq(memberActors.type, "Person")));

  // Deduplicate: keep highest-privilege role per group (host > moderator)
  const groupMap = new Map<string, (typeof rawRows)[0]>();
  for (const row of rawRows) {
    const existing = groupMap.get(row.id);
    if (!existing || (row.role === "owner" && existing.role !== "owner")) {
      groupMap.set(row.id, row);
    }
  }
  const rows = [...groupMap.values()];

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
        language: row.language,
        avatarUrl: row.avatarUrl,
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
