import { eq, and, or, sql } from "drizzle-orm";
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
  const inquiryId = url.searchParams.get("inquiryId");
  if (!eventId || !inquiryId) {
    return Response.json(
      { error: "eventId and inquiryId are required" },
      { status: 400 },
    );
  }

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

  // Verify the inquiry root exists and belongs to this event
  const [rootPost] = await db
    .select({
      id: posts.id,
      eventId: posts.eventId,
      threadStatus: posts.threadStatus,
    })
    .from(posts)
    .where(and(eq(posts.id, inquiryId), eq(posts.eventId, eventId)))
    .limit(1);

  if (!rootPost) {
    return Response.json({ error: "Inquiry not found" }, { status: 404 });
  }

  // Fetch all messages: the root + all replies in this thread
  const messages = await db
    .select({
      id: posts.id,
      content: posts.content,
      published: posts.published,
      createdAt: posts.createdAt,
      inReplyToPostId: posts.inReplyToPostId,
      visibility: posts.visibility,
      actorId: posts.actorId,
      actorHandle: actors.handle,
      actorName: actors.name,
      actorAvatarUrl: actors.avatarUrl,
      actorDomain: actors.domain,
      actorIsLocal: actors.isLocal,
    })
    .from(posts)
    .innerJoin(actors, eq(posts.actorId, actors.id))
    .where(
      or(eq(posts.id, inquiryId), eq(posts.threadRootId, inquiryId)),
    )
    .orderBy(sql`${posts.createdAt} ASC`);

  // Build distinct participants list (excluding the group actor)
  const seen = new Set<string>();
  const participants = messages
    .filter((m) => {
      if (m.actorId === event.groupActorId) return false;
      if (seen.has(m.actorId)) return false;
      seen.add(m.actorId);
      return true;
    })
    .map((m) => ({
      actorId: m.actorId,
      actorHandle: m.actorHandle,
      actorName: m.actorName,
      actorAvatarUrl: m.actorAvatarUrl,
      actorDomain: m.actorDomain,
      actorIsLocal: m.actorIsLocal,
    }));

  return Response.json({
    inquiryId,
    groupActorId: event.groupActorId,
    threadStatus: rootPost.threadStatus,
    messages,
    participants,
  });
};
