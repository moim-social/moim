import { eq, and } from "drizzle-orm";
import { db } from "~/server/db/client";
import { actors, events, eventOrganizers, groupMembers } from "~/server/db/schema";
import { getSessionUser } from "~/server/auth";
import { announceEvent } from "~/server/fediverse/category";

export const POST = async ({ request }: { request: Request }) => {
  const user = await getSessionUser(request);
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    eventId?: string;
    published?: boolean;
  } | null;

  if (!body?.eventId || typeof body.published !== "boolean") {
    return Response.json(
      { error: "eventId and published (boolean) are required" },
      { status: 400 },
    );
  }

  // Look up the event
  const [event] = await db
    .select({
      id: events.id,
      organizerId: events.organizerId,
      groupActorId: events.groupActorId,
      published: events.published,
      categoryId: events.categoryId,
      country: events.country,
      title: events.title,
      description: events.description,
      startsAt: events.startsAt,
      endsAt: events.endsAt,
      timezone: events.timezone,
      externalUrl: events.externalUrl,
    })
    .from(events)
    .where(eq(events.id, body.eventId))
    .limit(1);

  if (!event) {
    return Response.json({ error: "Event not found" }, { status: 404 });
  }

  // Authorization (same as update)
  if (event.groupActorId) {
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
  } else {
    if (event.organizerId !== user.id) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  // No-op if already in desired state
  if (event.published === body.published) {
    return Response.json({ event: { id: event.id, published: event.published } });
  }

  // Update published flag
  await db
    .update(events)
    .set({ published: body.published })
    .where(eq(events.id, event.id));

  // When publishing (false → true), federate the event
  if (body.published) {
    const isPersonalEvent = !event.groupActorId;
    const hostActorId = event.groupActorId ?? (
      await db
        .select({ id: actors.id })
        .from(actors)
        .where(and(eq(actors.userId, user.id), eq(actors.type, "Person"), eq(actors.isLocal, true)))
        .limit(1)
    )[0]?.id;

    if (hostActorId) {
      // Get organizers
      const organizers = await db
        .select({ handle: actors.handle, actorUrl: actors.actorUrl })
        .from(eventOrganizers)
        .innerJoin(actors, eq(eventOrganizers.actorId, actors.id))
        .where(eq(eventOrganizers.eventId, event.id));

      // Get creator mention for personal events
      let creatorMention: { handle: string; actorUrl: string; inboxUrl: string } | undefined;
      if (isPersonalEvent) {
        const [remoteActor] = await db
          .select({ handle: actors.handle, actorUrl: actors.actorUrl, inboxUrl: actors.inboxUrl })
          .from(actors)
          .where(and(eq(actors.userId, user.id), eq(actors.isLocal, false)))
          .limit(1);
        if (remoteActor?.inboxUrl) {
          creatorMention = { handle: remoteActor.handle, actorUrl: remoteActor.actorUrl, inboxUrl: remoteActor.inboxUrl };
        }
      }

      await announceEvent(event.categoryId, hostActorId, event, organizers, {
        skipAnnounce: isPersonalEvent,
        creatorMention,
      });
    }
  }

  return Response.json({ event: { id: event.id, published: body.published } });
};
