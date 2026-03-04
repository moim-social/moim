import { eq, and, sql, type SQL } from "drizzle-orm";
import { db } from "~/server/db/client";
import {
  events,
  actors,
  groupMembers,
  activityLogs,
} from "~/server/db/schema";
import { getSessionUser } from "~/server/auth";

export const GET = async ({ request }: { request: Request }) => {
  const user = await getSessionUser(request);
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const eventId = url.searchParams.get("eventId");
  if (!eventId) {
    return Response.json({ error: "eventId is required" }, { status: 400 });
  }

  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "20", 10), 100);
  const offset = parseInt(url.searchParams.get("offset") ?? "0", 10);
  const actorId = url.searchParams.get("actorId");
  const type = url.searchParams.get("type"); // like, emoji_react, announce, reply, quote

  // Get event + access check
  const [event] = await db
    .select({ id: events.id, groupActorId: events.groupActorId })
    .from(events)
    .where(eq(events.id, eventId))
    .limit(1);

  if (!event) {
    return Response.json({ error: "Event not found" }, { status: 404 });
  }
  if (!event.groupActorId) {
    return Response.json({ error: "Dashboard is only available for group events" }, { status: 400 });
  }

  const [membership] = await db
    .select({ role: groupMembers.role })
    .from(groupMembers)
    .innerJoin(actors, eq(groupMembers.memberActorId, actors.id))
    .where(
      and(
        eq(groupMembers.groupActorId, event.groupActorId),
        eq(actors.userId, user.id),
        eq(actors.type, "Person"),
      ),
    )
    .limit(1);

  if (!membership) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  // Build where conditions
  const conditions: SQL[] = [eq(activityLogs.eventId, eventId)];
  if (actorId) {
    conditions.push(eq(activityLogs.actorId, actorId));
  }
  if (type) {
    // Support compound filters
    if (type === "reactions") {
      conditions.push(sql`${activityLogs.type} in ('like', 'emoji_react')`);
    } else if (type === "reposts") {
      conditions.push(eq(activityLogs.type, "announce"));
    } else if (type === "replies") {
      conditions.push(sql`${activityLogs.type} in ('reply', 'quote')`);
    } else {
      conditions.push(eq(activityLogs.type, type));
    }
  }

  const whereClause = and(...conditions)!;

  // Count total
  const [{ total }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(activityLogs)
    .where(whereClause);

  // Fetch page
  const items = await db
    .select({
      id: activityLogs.id,
      type: activityLogs.type,
      emoji: activityLogs.emoji,
      content: activityLogs.content,
      createdAt: activityLogs.createdAt,
      actorId: activityLogs.actorId,
      actorHandle: actors.handle,
      actorName: actors.name,
    })
    .from(activityLogs)
    .innerJoin(actors, eq(activityLogs.actorId, actors.id))
    .where(whereClause)
    .orderBy(sql`${activityLogs.createdAt} DESC`)
    .limit(limit)
    .offset(offset);

  return Response.json({ items, total });
};
