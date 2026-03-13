import { eq, and, sql, isNull, isNotNull } from "drizzle-orm";
import { db } from "~/server/db/client";
import {
  events,
  actors,
  groupMembers,
  posts,
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

  const limit = Math.min(
    parseInt(url.searchParams.get("limit") ?? "20", 10),
    100,
  );
  const offset = parseInt(url.searchParams.get("offset") ?? "0", 10);
  const status = url.searchParams.get("status"); // 'new' | 'needs_response' | 'resolved'

  // Get event + access check (group events only)
  const [event] = await db
    .select({ id: events.id, groupActorId: events.groupActorId })
    .from(events)
    .where(eq(events.id, eventId))
    .limit(1);

  if (!event) {
    return Response.json({ error: "Event not found" }, { status: 404 });
  }
  if (!event.groupActorId) {
    return Response.json(
      { error: "Discussions are only available for group events" },
      { status: 400 },
    );
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

  // Build where: inquiry roots have threadStatus set, eventId matches, threadRootId is null
  const conditions = [
    eq(posts.eventId, eventId),
    isNotNull(posts.threadStatus),
    isNull(posts.threadRootId),
    isNotNull(posts.inReplyToPostId),
  ];

  if (status) {
    conditions.push(eq(posts.threadStatus, status));
  }

  const whereClause = and(...conditions)!;

  // Count total
  const [{ total }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(posts)
    .where(whereClause);

  // Fetch inquiry roots with actor info and aggregated stats
  const inquiries = await db
    .select({
      id: posts.id,
      content: posts.content,
      published: posts.published,
      createdAt: posts.createdAt,
      threadStatus: posts.threadStatus,
      lastRepliedAt: posts.lastRepliedAt,
      visibility: posts.visibility,
      actorId: posts.actorId,
      actorHandle: actors.handle,
      actorName: actors.name,
      actorAvatarUrl: actors.avatarUrl,
      actorDomain: actors.domain,
      replyCount: sql<number>`(
        SELECT count(*)::int FROM posts AS replies
        WHERE replies.thread_root_id = ${posts.id}
      )`,
      participantCount: sql<number>`(
        SELECT count(distinct replies.actor_id)::int FROM posts AS replies
        WHERE replies.thread_root_id = ${posts.id}
      )`,
    })
    .from(posts)
    .innerJoin(actors, eq(posts.actorId, actors.id))
    .where(whereClause)
    .orderBy(sql`COALESCE(${posts.lastRepliedAt}, ${posts.createdAt}) DESC`)
    .limit(limit)
    .offset(offset);

  // Status counts for filter badges
  const statusCounts = await db
    .select({
      status: posts.threadStatus,
      count: sql<number>`count(*)::int`,
    })
    .from(posts)
    .where(
      and(
        eq(posts.eventId, eventId),
        isNotNull(posts.threadStatus),
        isNull(posts.threadRootId),
        isNotNull(posts.inReplyToPostId),
      ),
    )
    .groupBy(posts.threadStatus);

  const counts = {
    total,
    new: statusCounts.find((c) => c.status === "new")?.count ?? 0,
    needsResponse:
      statusCounts.find((c) => c.status === "needs_response")?.count ?? 0,
    resolved: statusCounts.find((c) => c.status === "resolved")?.count ?? 0,
  };

  return Response.json({ inquiries, counts });
};
