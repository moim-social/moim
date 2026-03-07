import { eq, and, sql } from "drizzle-orm";
import { db } from "~/server/db/client";
import { rsvps, rsvpAnswers, eventQuestions, eventTiers } from "~/server/db/schema";
import { getSessionUser } from "~/server/auth";

export const GET = async ({ request }: { request: Request }) => {
  const url = new URL(request.url);
  const eventId = url.searchParams.get("eventId");

  if (!eventId) {
    return Response.json({ error: "eventId is required" }, { status: 400 });
  }

  // Get event questions
  const questions = await db
    .select({
      id: eventQuestions.id,
      question: eventQuestions.question,
      sortOrder: eventQuestions.sortOrder,
      required: eventQuestions.required,
    })
    .from(eventQuestions)
    .where(eq(eventQuestions.eventId, eventId))
    .orderBy(eventQuestions.sortOrder);

  // Get event tiers
  const tiers = await db
    .select({
      id: eventTiers.id,
      name: eventTiers.name,
      opensAt: eventTiers.opensAt,
      closesAt: eventTiers.closesAt,
      sortOrder: eventTiers.sortOrder,
    })
    .from(eventTiers)
    .where(eq(eventTiers.eventId, eventId))
    .orderBy(eventTiers.sortOrder);

  // Get RSVP counts
  const counts = await db
    .select({
      status: rsvps.status,
      count: sql<number>`count(*)::int`,
    })
    .from(rsvps)
    .where(eq(rsvps.eventId, eventId))
    .groupBy(rsvps.status);

  const rsvpCounts = {
    accepted: counts.find((c) => c.status === "accepted")?.count ?? 0,
    declined: counts.find((c) => c.status === "declined")?.count ?? 0,
  };

  // Get per-tier RSVP counts
  const tierCounts = await db
    .select({
      tierId: rsvps.tierId,
      status: rsvps.status,
      count: sql<number>`count(*)::int`,
    })
    .from(rsvps)
    .where(eq(rsvps.eventId, eventId))
    .groupBy(rsvps.tierId, rsvps.status);

  // Check current user's RSVP
  let userRsvp: { status: string; tierId: string | null; answers: Array<{ questionId: string; answer: string }> } | null = null;
  const user = await getSessionUser(request);
  if (user) {
    const [rsvp] = await db
      .select({ status: rsvps.status, tierId: rsvps.tierId })
      .from(rsvps)
      .where(and(eq(rsvps.userId, user.id), eq(rsvps.eventId, eventId)))
      .limit(1);

    if (rsvp) {
      const answers = await db
        .select({
          questionId: rsvpAnswers.questionId,
          answer: rsvpAnswers.answer,
        })
        .from(rsvpAnswers)
        .where(
          and(
            eq(rsvpAnswers.userId, user.id),
            eq(rsvpAnswers.eventId, eventId),
          ),
        );
      userRsvp = { status: rsvp.status!, tierId: rsvp.tierId, answers };
    }
  }

  return Response.json({ questions, tiers, rsvpCounts, tierCounts, userRsvp, isAuthenticated: !!user });
};
