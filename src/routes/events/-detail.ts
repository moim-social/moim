import { aliasedTable, and, eq, isNull, sql } from "drizzle-orm";
import { db } from "~/server/db/client";
import { events, actors, eventOrganizers, eventTiers, groupMembers, rsvps, eventQuestions, rsvpAnswers, users, places, userFediverseAccounts, posts } from "~/server/db/schema";
import { getSessionUser } from "~/server/auth";
import { env } from "~/server/env";

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
      timezone: events.timezone,
      location: events.location,
      externalUrl: events.externalUrl,
      placeId: events.placeId,
      headerImageUrl: events.headerImageUrl,
      published: events.published,
      createdAt: events.createdAt,
      placeName: places.name,
      placeAddress: places.address,
      placeLatitude: places.latitude,
      placeLongitude: places.longitude,
      groupHandle: actors.handle,
      groupName: actors.name,
      organizerHandle: userFediverseAccounts.fediverseHandle,
      organizerDisplayName: users.displayName,
      organizerActorUrl: organizerActors.url,
    })
    .from(events)
    .leftJoin(actors, eq(events.groupActorId, actors.id))
    .innerJoin(users, eq(events.organizerId, users.id))
    .leftJoin(userFediverseAccounts, and(
      eq(userFediverseAccounts.userId, users.id),
      eq(userFediverseAccounts.isPrimary, true),
    ))
    .leftJoin(organizerActors, and(
      eq(organizerActors.handle, userFediverseAccounts.fediverseHandle),
      eq(organizerActors.isLocal, false),
    ))
    .leftJoin(places, eq(events.placeId, places.id))
    .where(and(eq(events.id, eventId), isNull(events.deletedAt)))
    .limit(1);

  if (!event) {
    return Response.json({ error: "Event not found" }, { status: 404 });
  }

  // If unpublished, only allow organizer/group members to view
  if (!event.published) {
    const sessionUser = await getSessionUser(request);
    let canView = false;
    if (sessionUser) {
      const [eventRow] = await db
        .select({ organizerId: events.organizerId, groupActorId: events.groupActorId })
        .from(events)
        .where(eq(events.id, eventId))
        .limit(1);
      if (eventRow?.organizerId === sessionUser.id) {
        canView = true;
      } else if (eventRow?.groupActorId) {
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
        if (membership) canView = true;
      }
    }
    if (!canView) {
      return Response.json({ error: "Event not found" }, { status: 404 });
    }
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

  // Get tiers with RSVP counts
  const tiers = await db
    .select({
      id: eventTiers.id,
      name: eventTiers.name,
      opensAt: eventTiers.opensAt,
      closesAt: eventTiers.closesAt,
      sortOrder: eventTiers.sortOrder,
      rsvpCount: sql<number>`count(${rsvps.userId})::int`,
    })
    .from(eventTiers)
    .leftJoin(rsvps, eq(rsvps.tierId, eventTiers.id))
    .where(eq(eventTiers.eventId, eventId))
    .groupBy(eventTiers.id)
    .orderBy(eventTiers.sortOrder);

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

  // Get event note AP URL (the post created when event is published)
  let eventNoteApUrl: string | null = null;
  if (event.published) {
    const [eventNote] = await db
      .select({ id: posts.id })
      .from(posts)
      .where(
        and(
          eq(posts.eventId, eventId),
          isNull(posts.inReplyToPostId),
          isNull(posts.threadRootId),
          isNull(posts.threadStatus),
        ),
      )
      .limit(1);
    if (eventNote) {
      eventNoteApUrl = `${env.baseUrl}/ap/notes/${eventNote.id}`;
    }
  }

  return Response.json({
    event,
    organizers,
    rsvpCounts,
    questionCount,
    questions,
    tiers,
    canEdit,
    eventNoteApUrl,
  });
};
