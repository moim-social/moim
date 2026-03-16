import { eq, and, sql } from "drizzle-orm";
import { db } from "~/server/db/client";
import { rsvps, rsvpAnswers, eventQuestions, events, eventTiers } from "~/server/db/schema";
import { getSessionUser } from "~/server/auth";
import { autoPromoteWaitlist } from "~/server/events/waitlist";

export const POST = async ({ request }: { request: Request }) => {
  const user = await getSessionUser(request);
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    eventId?: string;
    status?: "accepted" | "declined";
    tierId?: string;
    answers?: Array<{ questionId: string; answer: string }>;
  } | null;

  if (!body?.eventId || !body?.status) {
    return Response.json({ error: "eventId and status are required" }, { status: 400 });
  }

  if (body.status !== "accepted" && body.status !== "declined") {
    return Response.json({ error: "status must be 'accepted' or 'declined'" }, { status: 400 });
  }

  // Verify event exists
  const [event] = await db
    .select({ id: events.id, startsAt: events.startsAt })
    .from(events)
    .where(eq(events.id, body.eventId))
    .limit(1);

  if (!event) {
    return Response.json({ error: "Event not found" }, { status: 404 });
  }

  // Resolve tier
  let resolvedTierId: string | null = null;
  let tierCapacity: number | null = null;
  if (body.status === "accepted") {
    const tiers = await db
      .select({
        id: eventTiers.id,
        opensAt: eventTiers.opensAt,
        closesAt: eventTiers.closesAt,
        capacity: eventTiers.capacity,
      })
      .from(eventTiers)
      .where(eq(eventTiers.eventId, body.eventId))
      .orderBy(eventTiers.sortOrder);

    if (tiers.length > 0) {
      if (body.tierId) {
        const tier = tiers.find((t) => t.id === body.tierId);
        if (!tier) {
          return Response.json({ error: "Invalid tier for this event" }, { status: 400 });
        }
        // Validate date range
        const now = new Date();
        if (tier.opensAt && now < tier.opensAt) {
          return Response.json({ error: "This tier is not yet open for registration" }, { status: 400 });
        }
        const closesAt = tier.closesAt ?? event.startsAt;
        if (now > closesAt) {
          return Response.json({ error: "This tier is no longer open for registration" }, { status: 400 });
        }
        resolvedTierId = tier.id;
        tierCapacity = tier.capacity;
      } else if (tiers.length === 1) {
        const tier = tiers[0];
        const now = new Date();
        if (tier.opensAt && now < tier.opensAt) {
          return Response.json({ error: "Registration is not yet open" }, { status: 400 });
        }
        const closesAt = tier.closesAt ?? event.startsAt;
        if (now > closesAt) {
          return Response.json({ error: "Registration is closed" }, { status: 400 });
        }
        resolvedTierId = tier.id;
        tierCapacity = tier.capacity;
      } else {
        return Response.json({ error: "tierId is required for multi-tier events" }, { status: 400 });
      }
    }
  }

  // If accepting, validate required questions are answered
  if (body.status === "accepted") {
    const questions = await db
      .select({ id: eventQuestions.id, required: eventQuestions.required })
      .from(eventQuestions)
      .where(eq(eventQuestions.eventId, body.eventId));

    const requiredIds = new Set(
      questions.filter((q) => q.required).map((q) => q.id),
    );
    const answeredIds = new Set(
      (body.answers ?? []).filter((a) => a.answer.trim()).map((a) => a.questionId),
    );

    for (const reqId of requiredIds) {
      if (!answeredIds.has(reqId)) {
        return Response.json(
          { error: "All required questions must be answered" },
          { status: 400 },
        );
      }
    }
  }

  // Check for existing active RSVP
  if (body.status === "accepted") {
    const [existing] = await db
      .select({ status: rsvps.status })
      .from(rsvps)
      .where(and(eq(rsvps.userId, user.id), eq(rsvps.eventId, body.eventId)))
      .limit(1);

    if (existing && (existing.status === "accepted" || existing.status === "waitlisted")) {
      return Response.json(
        { error: "You are already registered for this event" },
        { status: 409 },
      );
    }
  }

  try {
    let finalStatus: string = body.status;

    await db.transaction(async (tx) => {
      if (body.status === "declined") {
        // Read current RSVP before updating
        const [currentRsvp] = await tx
          .select({ status: rsvps.status, tierId: rsvps.tierId })
          .from(rsvps)
          .where(and(eq(rsvps.userId, user.id), eq(rsvps.eventId, body.eventId!)))
          .limit(1);

        // Upsert to declined
        await tx
          .insert(rsvps)
          .values({
            userId: user.id,
            eventId: body.eventId!,
            tierId: null,
            status: "declined",
          })
          .onConflictDoUpdate({
            target: [rsvps.userId, rsvps.eventId],
            set: { status: "declined", tierId: null },
          });

        // Auto-promote if an accepted RSVP was declined
        if (currentRsvp?.status === "accepted" && currentRsvp.tierId) {
          await autoPromoteWaitlist(tx, currentRsvp.tierId, 1);
        }

        finalStatus = "declined";
      } else {
        // Accepting: check capacity
        let effectiveStatus: "accepted" | "waitlisted" = "accepted";

        if (resolvedTierId && tierCapacity != null && tierCapacity > 0) {
          // Lock and count accepted RSVPs for this tier to prevent races
          const [countRow] = await tx
            .select({ count: sql<number>`count(*)::int` })
            .from(rsvps)
            .where(
              and(
                eq(rsvps.tierId, resolvedTierId),
                eq(rsvps.status, "accepted"),
              ),
            );
          const acceptedCount = countRow?.count ?? 0;

          // If user already has an accepted RSVP for this tier, don't count them again
          const [existingRsvp] = await tx
            .select({ status: rsvps.status, tierId: rsvps.tierId })
            .from(rsvps)
            .where(and(eq(rsvps.userId, user.id), eq(rsvps.eventId, body.eventId!)))
            .limit(1);

          const alreadyAcceptedInTier =
            existingRsvp?.status === "accepted" && existingRsvp.tierId === resolvedTierId;

          if (!alreadyAcceptedInTier && acceptedCount >= tierCapacity) {
            effectiveStatus = "waitlisted";
          }
        }

        // Upsert RSVP
        await tx
          .insert(rsvps)
          .values({
            userId: user.id,
            eventId: body.eventId!,
            tierId: resolvedTierId,
            status: effectiveStatus,
          })
          .onConflictDoUpdate({
            target: [rsvps.userId, rsvps.eventId],
            set: { status: effectiveStatus, tierId: resolvedTierId },
          });

        finalStatus = effectiveStatus;
      }

      // Delete old answers
      await tx
        .delete(rsvpAnswers)
        .where(
          and(
            eq(rsvpAnswers.userId, user.id),
            eq(rsvpAnswers.eventId, body.eventId!),
          ),
        );

      // Insert new answers (if accepting or waitlisted)
      if (body.status === "accepted" && body.answers && body.answers.length > 0) {
        const validAnswers = body.answers.filter((a) => a.answer.trim());
        if (validAnswers.length > 0) {
          await tx.insert(rsvpAnswers).values(
            validAnswers.map((a) => ({
              userId: user.id,
              eventId: body.eventId!,
              questionId: a.questionId,
              answer: a.answer,
            })),
          );
        }
      }
    });

    return Response.json({ ok: true, status: finalStatus });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to submit RSVP";
    return Response.json({ error: message }, { status: 500 });
  }
};
