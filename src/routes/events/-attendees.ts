import { eq, and } from "drizzle-orm";
import { db } from "~/server/db/client";
import {
  events,
  rsvps,
  rsvpAnswers,
  eventQuestions,
  users,
  actors,
  groupMembers,
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
    .select({ id: events.id, groupActorId: events.groupActorId })
    .from(events)
    .where(eq(events.id, eventId))
    .limit(1);

  if (!event) {
    return Response.json({ error: "Event not found" }, { status: 404 });
  }

  // Check if user is organizer/moderator of the group
  if (event.groupActorId) {
    const [personActor] = await db
      .select({ id: actors.id })
      .from(actors)
      .where(eq(actors.userId, user.id))
      .limit(1);

    if (!personActor) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const [membership] = await db
      .select({ role: groupMembers.role })
      .from(groupMembers)
      .where(
        and(
          eq(groupMembers.groupActorId, event.groupActorId),
          eq(groupMembers.memberActorId, personActor.id),
        ),
      )
      .limit(1);

    if (!membership) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }
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

  // Get all RSVPs with user info
  const rsvpRows = await db
    .select({
      userId: rsvps.userId,
      status: rsvps.status,
      createdAt: rsvps.createdAt,
      handle: users.fediverseHandle,
      displayName: users.displayName,
    })
    .from(rsvps)
    .innerJoin(users, eq(rsvps.userId, users.id))
    .where(eq(rsvps.eventId, eventId));

  // Get all answers for this event
  const allAnswers = await db
    .select({
      userId: rsvpAnswers.userId,
      questionId: rsvpAnswers.questionId,
      answer: rsvpAnswers.answer,
    })
    .from(rsvpAnswers)
    .where(eq(rsvpAnswers.eventId, eventId));

  // Group answers by userId
  const answersByUser = new Map<string, Array<{ questionId: string; answer: string }>>();
  for (const a of allAnswers) {
    if (!answersByUser.has(a.userId)) {
      answersByUser.set(a.userId, []);
    }
    answersByUser.get(a.userId)!.push({
      questionId: a.questionId,
      answer: a.answer,
    });
  }

  const attendees = rsvpRows.map((r) => ({
    userId: r.userId,
    handle: r.handle,
    displayName: r.displayName,
    status: r.status,
    createdAt: r.createdAt,
    answers: answersByUser.get(r.userId) ?? [],
  }));

  return Response.json({ questions, attendees });
};
