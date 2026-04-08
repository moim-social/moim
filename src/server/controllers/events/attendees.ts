import { eq, and } from "drizzle-orm";
import { db } from "~/server/db/client";
import {
  events,
  rsvps,
  rsvpAnswers,
  eventQuestions,
  eventOrganizers,
  eventTiers,
  users,
  actors,
  groupMembers,
  userFediverseAccounts,
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

  // Get event and its group
  const [event] = await db
    .select({ id: events.id, organizerId: events.organizerId, groupActorId: events.groupActorId })
    .from(events)
    .where(eq(events.id, eventId))
    .limit(1);

  if (!event) {
    return Response.json({ error: "Event not found" }, { status: 404 });
  }

  // Check if user is organizer, group member, or co-organizer
  let hasAccess = false;

  // Event owner
  if (event.organizerId === user.id) {
    hasAccess = true;
  }

  // Group member (owner/moderator)
  if (!hasAccess && event.groupActorId) {
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
    if (membership) hasAccess = true;
  }

  // Co-organizer listed in eventOrganizers
  if (!hasAccess) {
    const [coOrg] = await db
      .select({ id: eventOrganizers.id })
      .from(eventOrganizers)
      .innerJoin(actors, eq(eventOrganizers.actorId, actors.id))
      .where(
        and(
          eq(eventOrganizers.eventId, eventId),
          eq(actors.userId, user.id),
        ),
      )
      .limit(1);
    if (coOrg) hasAccess = true;
  }

  if (!hasAccess) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  // Get questions for this event
  const questions = await db
    .select({
      id: eventQuestions.id,
      question: eventQuestions.question,
      sortOrder: eventQuestions.sortOrder,
    })
    .from(eventQuestions)
    .where(eq(eventQuestions.eventId, eventId))
    .orderBy(eventQuestions.sortOrder);

  // Get event tiers
  const tiers = await db
    .select({
      id: eventTiers.id,
      name: eventTiers.name,
      sortOrder: eventTiers.sortOrder,
    })
    .from(eventTiers)
    .where(eq(eventTiers.eventId, eventId))
    .orderBy(eventTiers.sortOrder);

  // Get all RSVPs with user info (leftJoin for anonymous RSVPs)
  const rsvpRows = await db
    .select({
      rsvpId: rsvps.id,
      userId: rsvps.userId,
      status: rsvps.status,
      tierId: rsvps.tierId,
      tierName: eventTiers.name,
      createdAt: rsvps.createdAt,
      handle: userFediverseAccounts.fediverseHandle,
      userDisplayName: users.displayName,
      avatarUrl: users.avatarUrl,
      anonDisplayName: rsvps.displayName,
      anonEmail: rsvps.email,
      anonPhone: rsvps.phone,
    })
    .from(rsvps)
    .leftJoin(users, eq(rsvps.userId, users.id))
    .leftJoin(eventTiers, eq(rsvps.tierId, eventTiers.id))
    .leftJoin(userFediverseAccounts, and(
      eq(userFediverseAccounts.userId, users.id),
      eq(userFediverseAccounts.isPrimary, true),
    ))
    .where(eq(rsvps.eventId, eventId));

  // Get all answers for this event, grouped by rsvpId
  const allAnswers = await db
    .select({
      rsvpId: rsvpAnswers.rsvpId,
      questionId: rsvpAnswers.questionId,
      answer: rsvpAnswers.answer,
    })
    .from(rsvpAnswers)
    .where(eq(rsvpAnswers.eventId, eventId));

  const answersByRsvp = new Map<string, Array<{ questionId: string; answer: string }>>();
  for (const a of allAnswers) {
    if (!answersByRsvp.has(a.rsvpId)) {
      answersByRsvp.set(a.rsvpId, []);
    }
    answersByRsvp.get(a.rsvpId)!.push({
      questionId: a.questionId,
      answer: a.answer,
    });
  }

  const attendees = rsvpRows.map((r) => ({
    rsvpId: r.rsvpId,
    userId: r.userId,
    isAnonymous: r.userId === null,
    handle: r.handle,
    displayName: r.userDisplayName ?? r.anonDisplayName ?? "Anonymous",
    avatarUrl: r.avatarUrl,
    email: r.anonEmail,
    phone: r.anonPhone,
    status: r.status,
    tierId: r.tierId,
    tierName: r.tierName,
    createdAt: r.createdAt,
    answers: answersByRsvp.get(r.rsvpId) ?? [],
  }));

  return Response.json({ questions, tiers, attendees });
};
