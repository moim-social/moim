import { eq, and, sql, lt } from "drizzle-orm";
import { db } from "~/server/db/client";
import { rsvps, rsvpAnswers, eventQuestions, eventTiers, events } from "~/server/db/schema";
import { getSessionUser } from "~/server/auth";
import { parseCookie } from "~/server/auth";

export const GET = async ({ request }: { request: Request }) => {
  const url = new URL(request.url);
  const eventId = url.searchParams.get("eventId");

  if (!eventId) {
    return Response.json({ error: "eventId is required" }, { status: 400 });
  }

  // Get event with anonymous RSVP config
  const [event] = await db
    .select({
      id: events.id,
      allowAnonymousRsvp: events.allowAnonymousRsvp,
      anonymousContactFields: events.anonymousContactFields,
    })
    .from(events)
    .where(eq(events.id, eventId))
    .limit(1);

  if (!event) {
    return Response.json({ error: "Event not found" }, { status: 404 });
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

  // Get event tiers with capacity
  const tiers = await db
    .select({
      id: eventTiers.id,
      name: eventTiers.name,
      description: eventTiers.description,
      price: eventTiers.price,
      opensAt: eventTiers.opensAt,
      closesAt: eventTiers.closesAt,
      capacity: eventTiers.capacity,
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
    waitlisted: counts.find((c) => c.status === "waitlisted")?.count ?? 0,
  };

  // Count anonymous RSVPs
  const [anonCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(rsvps)
    .where(
      and(
        eq(rsvps.eventId, eventId),
        sql`user_id IS NULL`,
        sql`status != 'declined'`,
      ),
    );
  const anonymousCount = anonCount?.count ?? 0;

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

  // Check current user's RSVP (authenticated or anonymous via token)
  let userRsvp: {
    status: string;
    tierId: string | null;
    answers: Array<{ questionId: string; answer: string }>;
    waitlistPosition: number | null;
  } | null = null;
  const user = await getSessionUser(request);

  if (user) {
    const [rsvp] = await db
      .select({ id: rsvps.id, status: rsvps.status, tierId: rsvps.tierId, createdAt: rsvps.createdAt })
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
        .where(eq(rsvpAnswers.rsvpId, rsvp.id));

      // Compute waitlist position if waitlisted
      let waitlistPosition: number | null = null;
      if (rsvp.status === "waitlisted" && rsvp.tierId && rsvp.createdAt) {
        const [posRow] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(rsvps)
          .where(
            and(
              eq(rsvps.tierId, rsvp.tierId),
              eq(rsvps.status, "waitlisted"),
              lt(rsvps.createdAt, rsvp.createdAt),
            ),
          );
        waitlistPosition = (posRow?.count ?? 0) + 1;
      }

      userRsvp = { status: rsvp.status!, tierId: rsvp.tierId, answers, waitlistPosition };
    }
  } else {
    // Check for anonymous RSVP via cookie or query param token
    const cookieName = `anon_rsvp_${eventId}`;
    const token = url.searchParams.get("token") || parseCookie(request.headers.get("cookie"), cookieName);
    if (token) {
      const [rsvp] = await db
        .select({ id: rsvps.id, status: rsvps.status, tierId: rsvps.tierId, createdAt: rsvps.createdAt })
        .from(rsvps)
        .where(and(eq(rsvps.token, token), eq(rsvps.eventId, eventId)))
        .limit(1);

      if (rsvp) {
        const answers = await db
          .select({
            questionId: rsvpAnswers.questionId,
            answer: rsvpAnswers.answer,
          })
          .from(rsvpAnswers)
          .where(eq(rsvpAnswers.rsvpId, rsvp.id));

        let waitlistPosition: number | null = null;
        if (rsvp.status === "waitlisted" && rsvp.tierId && rsvp.createdAt) {
          const [posRow] = await db
            .select({ count: sql<number>`count(*)::int` })
            .from(rsvps)
            .where(
              and(
                eq(rsvps.tierId, rsvp.tierId),
                eq(rsvps.status, "waitlisted"),
                lt(rsvps.createdAt, rsvp.createdAt),
              ),
            );
          waitlistPosition = (posRow?.count ?? 0) + 1;
        }

        userRsvp = { status: rsvp.status!, tierId: rsvp.tierId, answers, waitlistPosition };
      }
    }
  }

  return Response.json({
    questions,
    tiers,
    rsvpCounts,
    tierCounts,
    userRsvp,
    isAuthenticated: !!user,
    allowAnonymousRsvp: event.allowAnonymousRsvp,
    anonymousContactFields: event.anonymousContactFields,
    anonymousCount,
  });
};
