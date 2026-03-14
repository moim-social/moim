import { eq, and, or, sql } from "drizzle-orm";
import { db } from "~/server/db/client";
import { events, actors, posts } from "~/server/db/schema";
import { env } from "~/server/env";

export const GET = async ({ request }: { request: Request }) => {
  const url = new URL(request.url);
  const eventId = url.searchParams.get("eventId");
  const inquiryId = url.searchParams.get("inquiryId");
  if (!eventId || !inquiryId) {
    return Response.json(
      { error: "eventId and inquiryId are required" },
      { status: 400 },
    );
  }

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
    return Response.json({ error: "Not a group event" }, { status: 400 });
  }

  // Verify the inquiry root exists, belongs to this event, and is public/unlisted
  const [rootPost] = await db
    .select({
      id: posts.id,
      visibility: posts.visibility,
    })
    .from(posts)
    .where(and(eq(posts.id, inquiryId), eq(posts.eventId, eventId)))
    .limit(1);

  if (!rootPost) {
    return Response.json({ error: "Inquiry not found" }, { status: 404 });
  }

  const vis = rootPost.visibility ?? "public";
  if (vis !== "public" && vis !== "unlisted") {
    return Response.json({ error: "Inquiry not found" }, { status: 404 });
  }

  // Fetch public/unlisted messages in this thread
  const messages = await db
    .select({
      id: posts.id,
      content: posts.content,
      createdAt: posts.createdAt,
      inReplyToPostId: posts.inReplyToPostId,
      apUri: posts.apUri,
      actorHandle: actors.handle,
      actorName: actors.name,
      actorAvatarUrl: actors.avatarUrl,
      actorDomain: actors.domain,
    })
    .from(posts)
    .innerJoin(actors, eq(posts.actorId, actors.id))
    .where(
      and(
        or(eq(posts.id, inquiryId), eq(posts.threadRootId, inquiryId)),
        or(eq(posts.visibility, "public"), eq(posts.visibility, "unlisted")),
      ),
    )
    .orderBy(sql`${posts.createdAt} ASC`);

  const messagesWithApUrl = messages.map((m) => ({
    ...m,
    apUrl: m.apUri ?? `${env.baseUrl}/ap/notes/${m.id}`,
  }));

  return Response.json({ messages: messagesWithApUrl });
};
