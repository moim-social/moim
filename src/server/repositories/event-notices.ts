import { eq, desc, count } from "drizzle-orm";
import { db } from "~/server/db/client";
import { eventNotices, posts, actors } from "~/server/db/schema";

export async function createNoticeRecord(params: {
  eventId: string;
  postId: string;
  sentByUserId: string;
}) {
  const [row] = await db
    .insert(eventNotices)
    .values(params)
    .returning();
  return row;
}

export async function listNoticesByEvent(
  eventId: string,
  opts?: { limit?: number; offset?: number },
) {
  const limit = opts?.limit ?? 20;
  const offset = opts?.offset ?? 0;

  const [notices, [{ total }]] = await Promise.all([
    db
      .select({
        id: eventNotices.id,
        postId: eventNotices.postId,
        content: posts.content,
        senderHandle: actors.handle,
        senderName: actors.name,
        createdAt: eventNotices.createdAt,
      })
      .from(eventNotices)
      .innerJoin(posts, eq(eventNotices.postId, posts.id))
      .innerJoin(actors, eq(posts.actorId, actors.id))
      .where(eq(eventNotices.eventId, eventId))
      .orderBy(desc(eventNotices.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ total: count() })
      .from(eventNotices)
      .where(eq(eventNotices.eventId, eventId)),
  ]);

  return { notices, total };
}
