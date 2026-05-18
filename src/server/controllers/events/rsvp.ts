import { eq, and, sql } from "drizzle-orm";
import { db } from "~/server/db/client";
import { rsvps, rsvpAnswers, events, eventTiers } from "~/server/db/schema";
import { getSessionUser } from "~/server/auth";
import { autoPromoteWaitlist } from "~/server/events/waitlist";
import { resolveTier, validateRequiredAnswers, checkCapacityAndDetermineStatus } from "~/server/events/rsvp-helpers";
import { startPaidRegistration, TicketingError } from "~/server/services/ticketing";
import { createTicketPaymentClientFromEnv } from "~/server/services/ticket-payment-client";
import * as EventTicketingSettingsRepo from "~/server/repositories/event-ticketing-settings";
import * as TicketReservationsRepo from "~/server/repositories/ticket-reservations";
import * as TicketPaymentsRepo from "~/server/repositories/ticket-payments";

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
    .select({ id: events.id, title: events.title, startsAt: events.startsAt })
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
    const tierResult = await resolveTier(body.eventId, body.tierId, event.startsAt);
    if (tierResult instanceof Response) return tierResult;
    resolvedTierId = tierResult.tierId;
    tierCapacity = tierResult.capacity;
  }

  // If accepting, validate required questions are answered
  if (body.status === "accepted") {
    const validationError = await validateRequiredAnswers(body.eventId, body.answers);
    if (validationError) return validationError;
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

  if (body.status === "accepted" && resolvedTierId) {
    const [tier] = await db
      .select({ id: eventTiers.id, name: eventTiers.name, priceAmount: eventTiers.priceAmount })
      .from(eventTiers)
      .where(and(eq(eventTiers.id, resolvedTierId), eq(eventTiers.eventId, body.eventId)))
      .limit(1);

    if (tier && (tier.priceAmount ?? 0) > 0) {
      try {
        const paymentClient = createTicketPaymentClientFromEnv();
        const url = new URL(request.url);
        const result = await startPaidRegistration(
          {
            event: { id: event.id, title: event.title },
            tier: { id: tier.id, name: tier.name, priceAmount: tier.priceAmount },
            userId: user.id,
            customer: {},
            answers: body.answers ?? [],
            baseUrl: url.origin,
            callbackUrl: `${url.origin}/api/ticket-payment-callbacks`,
          },
          {
            getTicketingSetting: async (eventId) => {
              const setting = await EventTicketingSettingsRepo.findByEventId(eventId);
              return setting
                ? {
                    eventId: setting.eventId,
                    mode: setting.mode as "free" | "paid" | "external",
                    provider: setting.provider as "portone" | "opencollective" | null,
                    providerAccountId: setting.providerAccountId,
                    currency: setting.currency,
                    enabled: setting.enabled,
                  }
                : null;
            },
            createReservation: async (values) => {
              const reservation = await TicketReservationsRepo.insert({
                eventId: values.eventId,
                tierId: values.tierId,
                userId: values.userId,
                token: null,
                rsvpId: null,
                provider: values.provider,
                providerAccountId: values.providerAccountId,
                amount: values.amount,
                currency: values.currency,
                status: values.status,
                checkoutId: null,
                answersSnapshot: values.answersSnapshot,
                expiresAt: values.expiresAt,
              });
              return {
                id: reservation.id,
                eventId: reservation.eventId,
                tierId: reservation.tierId!,
                userId: reservation.userId!,
                provider: reservation.provider,
                providerAccountId: reservation.providerAccountId,
                amount: reservation.amount,
                currency: reservation.currency,
                status: "pending_payment",
                checkoutId: reservation.checkoutId,
                answersSnapshot: reservation.answersSnapshot as Array<{ questionId: string; answer: string }>,
                expiresAt: reservation.expiresAt,
              };
            },
            setReservationCheckoutId: async (reservationId, checkoutId) => {
              await TicketReservationsRepo.setCheckoutId(reservationId, checkoutId);
            },
            createPayment: async (values) => {
              await TicketPaymentsRepo.insert({
                reservationId: values.reservationId,
                provider: values.provider,
                providerPaymentId: null,
                providerTxId: null,
                checkoutId: values.checkoutId,
                status: values.status,
                amount: values.amount,
                currency: values.currency,
                rawEvent: null,
                paidAt: null,
              });
            },
            createCheckout: (input) => paymentClient.createCheckout(input),
            now: () => new Date(),
            addMinutes: (date, minutes) => new Date(date.getTime() + minutes * 60_000),
          },
        );

        if (result.requiresPayment) {
          return Response.json({ ok: true, ...result });
        }
      } catch (err) {
        if (err instanceof TicketingError) {
          return Response.json({ error: err.message }, { status: 400 });
        }
        const message = err instanceof Error ? err.message : "Failed to start payment";
        return Response.json({ error: message }, { status: 502 });
      }
    }
  }

  try {
    let finalStatus: string = body.status;

    await db.transaction(async (tx) => {
      if (body.status === "declined") {
        // Read current RSVP before updating
        const [currentRsvp] = await tx
          .select({ id: rsvps.id, status: rsvps.status, tierId: rsvps.tierId })
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
            targetWhere: sql`user_id IS NOT NULL`,
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

        // Find existing RSVP for capacity exclusion
        const [existingRsvp] = await tx
          .select({ id: rsvps.id, status: rsvps.status, tierId: rsvps.tierId })
          .from(rsvps)
          .where(and(eq(rsvps.userId, user.id), eq(rsvps.eventId, body.eventId!)))
          .limit(1);

        if (resolvedTierId && tierCapacity != null && tierCapacity > 0) {
          effectiveStatus = await checkCapacityAndDetermineStatus(
            tx,
            resolvedTierId,
            tierCapacity,
            existingRsvp?.id,
          );
        }

        // Upsert RSVP
        const [upsertedRsvp] = await tx
          .insert(rsvps)
          .values({
            userId: user.id,
            eventId: body.eventId!,
            tierId: resolvedTierId,
            status: effectiveStatus,
          })
          .onConflictDoUpdate({
            target: [rsvps.userId, rsvps.eventId],
            targetWhere: sql`user_id IS NOT NULL`,
            set: { status: effectiveStatus, tierId: resolvedTierId },
          })
          .returning({ id: rsvps.id });

        finalStatus = effectiveStatus;

        // Delete old answers
        await tx
          .delete(rsvpAnswers)
          .where(eq(rsvpAnswers.rsvpId, upsertedRsvp.id));

        // Insert new answers (if accepting or waitlisted)
        if (body.status === "accepted" && body.answers && body.answers.length > 0) {
          const validAnswers = body.answers.filter((a) => a.answer.trim());
          if (validAnswers.length > 0) {
            await tx.insert(rsvpAnswers).values(
              validAnswers.map((a) => ({
                rsvpId: upsertedRsvp.id,
                userId: user.id,
                eventId: body.eventId!,
                questionId: a.questionId,
                answer: a.answer,
              })),
            );
          }
        }
      }
    });

    return Response.json({ ok: true, status: finalStatus });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to submit RSVP";
    return Response.json({ error: message }, { status: 500 });
  }
};
