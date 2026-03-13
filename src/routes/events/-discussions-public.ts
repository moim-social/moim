import { eq, and, or, sql, isNull, isNotNull } from "drizzle-orm";
import { db } from "~/server/db/client";
import { events, actors, posts } from "~/server/db/schema";

export const GET = async ({ request }: { request: Request }) => {
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

  // Verify event exists and is a group event
  const [event] = await db
    .select({ id: events.id, groupActorId: events.groupActorId })
    .from(events)
    .where(eq(events.id, eventId))
    .limit(1);

  if (!event) {
    return Response.json({ error: "Event not found" }, { status: 404 });
  }
  if (!event.groupActorId) {
    return Response.json({ inquiries: [], total: 0 });
  }

  // Public visibility filter: only public + unlisted
  const visibilityFilter = or(
    eq(posts.visibility, "public"),
    eq(posts.visibility, "unlisted"),
  )!;

  // Count total public inquiry roots
  const [{ total }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(posts)
    .where(
      and(
        eq(posts.eventId, eventId),
        isNotNull(posts.threadStatus),
        isNull(posts.threadRootId),
        isNotNull(posts.inReplyToPostId),
        visibilityFilter,
      ),
    );

  // Fetch public inquiry roots with actor info
  const inquiries = await db
    .select({
      id: posts.id,
      content: posts.content,
      published: posts.published,
      createdAt: posts.createdAt,
      threadStatus: posts.threadStatus,
      lastRepliedAt: posts.lastRepliedAt,
      actorHandle: actors.handle,
      actorName: actors.name,
      actorAvatarUrl: actors.avatarUrl,
      actorDomain: actors.domain,
      replyCount: sql<number>`(
        SELECT count(*)::int FROM posts AS replies
        WHERE replies.thread_root_id = ${posts.id}
          AND (replies.visibility = 'public' OR replies.visibility = 'unlisted')
      )`,
    })
    .from(posts)
    .innerJoin(actors, eq(posts.actorId, actors.id))
    .where(
      and(
        eq(posts.eventId, eventId),
        isNotNull(posts.threadStatus),
        isNull(posts.threadRootId),
        isNotNull(posts.inReplyToPostId),
        visibilityFilter,
      ),
    )
    .orderBy(sql`COALESCE(${posts.lastRepliedAt}, ${posts.createdAt}) DESC`)
    .limit(limit)
    .offset(offset);

  return Response.json({ inquiries, total });
};
