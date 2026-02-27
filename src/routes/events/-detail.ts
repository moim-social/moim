import { eq, sql } from "drizzle-orm";
import { db } from "~/server/db/client";
import { events, actors, eventOrganizers, rsvps, eventQuestions, users } from "~/server/db/schema";

export const GET = async ({ request }: { request: Request }) => {
  const url = new URL(request.url);
  const eventId = url.searchParams.get("id");

  if (!eventId) {
    return Response.json({ error: "id is required" }, { status: 400 });
  }

  // Get event with group and organizer info
  const [event] = await db
    .select({
      id: events.id,
      title: events.title,
      description: events.description,
      categoryId: events.categoryId,
      startsAt: events.startsAt,
      endsAt: events.endsAt,
      location: events.location,
      createdAt: events.createdAt,
      groupHandle: actors.handle,
      groupName: actors.name,
      organizerHandle: users.handle,
      organizerDisplayName: users.displayName,
    })
    .from(events)
    .leftJoin(actors, eq(events.groupActorId, actors.id))
    .innerJoin(users, eq(events.organizerId, users.id))
    .where(eq(events.id, eventId))
    .limit(1);

  if (!event) {
    return Response.json({ error: "Event not found" }, { status: 404 });
  }

  // Get organizers
  const organizers = await db
    .select({
      handle: actors.handle,
      name: actors.name,
      actorUrl: actors.actorUrl,
      domain: actors.domain,
      isLocal: actors.isLocal,
    })
    .from(eventOrganizers)
    .innerJoin(actors, eq(eventOrganizers.actorId, actors.id))
    .where(eq(eventOrganizers.eventId, eventId));

  // Get RSVP counts
  const rsvpCountRows = await db
    .select({
      status: rsvps.status,
      count: sql<number>`count(*)::int`,
    })
    .from(rsvps)
    .where(eq(rsvps.eventId, eventId))
    .groupBy(rsvps.status);

  const rsvpCounts = {
    accepted: rsvpCountRows.find((c) => c.status === "accepted")?.count ?? 0,
    declined: rsvpCountRows.find((c) => c.status === "declined")?.count ?? 0,
  };

  // Get question count
  const [questionCountRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(eventQuestions)
    .where(eq(eventQuestions.eventId, eventId));

  return Response.json({
    event,
    organizers,
    rsvpCounts,
    questionCount: questionCountRow.count,
  });
};
