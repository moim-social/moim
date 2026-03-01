import { aliasedTable, and, eq, sql } from "drizzle-orm";
import { db } from "~/server/db/client";
import { events, actors, eventOrganizers, groupMembers, rsvps, eventQuestions, rsvpAnswers, users, places } from "~/server/db/schema";
import { getSessionUser } from "~/server/auth";

export const GET = async ({ request }: { request: Request }) => {
  const url = new URL(request.url);
  const eventId = url.searchParams.get("id");

  if (!eventId) {
    return Response.json({ error: "id is required" }, { status: 400 });
  }

  // Get event with group and organizer info
  const organizerActors = aliasedTable(actors, "organizer_actors");
  const [event] = await db
    .select({
      id: events.id,
      title: events.title,
      description: events.description,
      categoryId: events.categoryId,
      startsAt: events.startsAt,
      endsAt: events.endsAt,
      location: events.location,
      externalUrl: events.externalUrl,
      placeId: events.placeId,
      createdAt: events.createdAt,
      placeName: places.name,
      placeAddress: places.address,
      placeLatitude: places.latitude,
      placeLongitude: places.longitude,
      groupHandle: actors.handle,
      groupName: actors.name,
      organizerHandle: users.fediverseHandle,
      organizerDisplayName: users.displayName,
      organizerActorUrl: organizerActors.url,
    })
    .from(events)
    .leftJoin(actors, eq(events.groupActorId, actors.id))
    .innerJoin(users, eq(events.organizerId, users.id))
    .leftJoin(organizerActors, and(
      eq(organizerActors.userId, users.id),
      eq(organizerActors.isLocal, false),
    ))
    .leftJoin(places, eq(events.placeId, places.id))
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

  // Get questions with answer counts
  const questions = await db
    .select({
      id: eventQuestions.id,
      question: eventQuestions.question,
      sortOrder: eventQuestions.sortOrder,
      required: eventQuestions.required,
      answerCount: sql<number>`count(${rsvpAnswers.id})::int`,
    })
    .from(eventQuestions)
    .leftJoin(rsvpAnswers, eq(rsvpAnswers.questionId, eventQuestions.id))
    .where(eq(eventQuestions.eventId, eventId))
    .groupBy(eventQuestions.id)
    .orderBy(eventQuestions.sortOrder);

  const questionCount = questions.length;

  // Determine canEdit for the current user
  let canEdit = false;
  const sessionUser = await getSessionUser(request);
  if (sessionUser) {
    // Check if user is the event organizer
    const [eventRow] = await db
      .select({ organizerId: events.organizerId, groupActorId: events.groupActorId })
      .from(events)
      .where(eq(events.id, eventId))
      .limit(1);

    if (eventRow) {
      if (eventRow.organizerId === sessionUser.id) {
        canEdit = true;
      } else if (eventRow.groupActorId) {
        // Check group membership (join through actors to match any actor for this user)
        const [membership] = await db
          .select({ role: groupMembers.role })
          .from(groupMembers)
          .innerJoin(actors, eq(groupMembers.memberActorId, actors.id))
          .where(
            and(
              eq(groupMembers.groupActorId, eventRow.groupActorId),
              eq(actors.userId, sessionUser.id),
              eq(actors.type, "Person"),
            ),
          )
          .limit(1);

        if (membership) canEdit = true;
      }
    }
  }

  return Response.json({
    event,
    organizers,
    rsvpCounts,
    questionCount,
    questions,
    canEdit,
  });
};
