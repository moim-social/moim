import { and, eq, sql } from "drizzle-orm";
import { db } from "~/server/db/client";
import { eventTiers, rsvpAnswers, rsvps, ticketPayments, ticketReservations } from "~/server/db/schema";
import { checkCapacityAndDetermineStatus } from "~/server/events/rsvp-helpers";
import {
  parseTicketPaymentPaidCallback,
  verifyTicketPaymentCallbackSignature,
} from "~/server/services/ticket-payment-callback";

type ReservationRow = {
  id: string;
  eventId: string;
  tierId: string | null;
  userId: string | null;
  status: string;
  checkoutId: string | null;
  provider: string;
  amount: number;
  currency: string;
  answersSnapshot: unknown;
  expiresAt: Date;
};

export const POST = async ({ request }: { request: Request }) => {
  const secret = process.env.TICKET_PAYMENT_CALLBACK_SECRET;
  if (!secret) {
    return Response.json({ error: "Ticket payment callback is not configured" }, { status: 500 });
  }

  const rawBody = await request.text();
  const signature = request.headers.get("x-ticket-payment-signature");
  if (!verifyTicketPaymentCallbackSignature(rawBody, signature, secret)) {
    return Response.json({ error: "Invalid signature" }, { status: 401 });
  }

  const payload = parseTicketPaymentPaidCallback(rawBody);
  if (!payload) {
    return Response.json({ error: "Invalid callback payload" }, { status: 400 });
  }

  try {
    let rsvpId: string | null = null;

    await db.transaction(async (tx) => {
      const rows = await tx.execute(sql`
        SELECT
          id,
          event_id AS "eventId",
          tier_id AS "tierId",
          user_id AS "userId",
          status,
          checkout_id AS "checkoutId",
          provider,
          amount,
          currency,
          answers_snapshot AS "answersSnapshot",
          expires_at AS "expiresAt"
        FROM ticket_reservations
        WHERE id = ${payload.reservationId}
        LIMIT 1
        FOR UPDATE
      `);
      const reservation = rows.rows[0] as ReservationRow | undefined;

      if (!reservation) {
        throw new Response(JSON.stringify({ error: "Reservation not found" }), { status: 404 });
      }
      if (reservation.status === "confirmed") {
        return;
      }
      if (
        reservation.status !== "pending_payment" ||
        reservation.checkoutId !== payload.checkoutId ||
        reservation.provider !== payload.provider ||
        reservation.amount !== payload.amount ||
        reservation.currency !== payload.currency
      ) {
        throw new Response(JSON.stringify({ error: "Callback does not match reservation" }), { status: 409 });
      }
      if (reservation.expiresAt <= new Date()) {
        await tx
          .update(ticketReservations)
          .set({ status: "expired", updatedAt: new Date() })
          .where(eq(ticketReservations.id, reservation.id));
        throw new Response(JSON.stringify({ error: "Reservation expired" }), { status: 409 });
      }
      if (!reservation.userId || !reservation.tierId) {
        throw new Response(JSON.stringify({ error: "Reservation cannot create RSVP" }), { status: 409 });
      }

      const [tier] = await tx
        .select({ capacity: eventTiers.capacity })
        .from(eventTiers)
        .where(eq(eventTiers.id, reservation.tierId))
        .limit(1);

      const finalStatus =
        tier?.capacity != null && tier.capacity > 0
          ? await checkCapacityAndDetermineStatus(tx as any, reservation.tierId, tier.capacity)
          : "accepted";

      const [rsvp] = await tx
        .insert(rsvps)
        .values({
          userId: reservation.userId,
          eventId: reservation.eventId,
          tierId: reservation.tierId,
          status: finalStatus,
        })
        .onConflictDoUpdate({
          target: [rsvps.userId, rsvps.eventId],
          targetWhere: sql`user_id IS NOT NULL`,
          set: { status: finalStatus, tierId: reservation.tierId },
        })
        .returning({ id: rsvps.id });
      rsvpId = rsvp.id;

      const answers = Array.isArray(reservation.answersSnapshot)
        ? reservation.answersSnapshot.filter((answer): answer is { questionId: string; answer: string } => (
            typeof answer === "object" &&
            answer != null &&
            typeof (answer as { questionId?: unknown }).questionId === "string" &&
            typeof (answer as { answer?: unknown }).answer === "string" &&
            (answer as { answer: string }).answer.trim().length > 0
          ))
        : [];

      await tx.delete(rsvpAnswers).where(eq(rsvpAnswers.rsvpId, rsvp.id));
      if (answers.length > 0) {
        await tx.insert(rsvpAnswers).values(
          answers.map((answer) => ({
            rsvpId: rsvp.id,
            userId: reservation.userId,
            eventId: reservation.eventId,
            questionId: answer.questionId,
            answer: answer.answer,
          })),
        );
      }

      await tx
        .update(ticketReservations)
        .set({ status: "confirmed", rsvpId: rsvp.id, updatedAt: new Date() })
        .where(eq(ticketReservations.id, reservation.id));

      const [existingPayment] = await tx
        .select({ id: ticketPayments.id })
        .from(ticketPayments)
        .where(and(eq(ticketPayments.reservationId, reservation.id), eq(ticketPayments.checkoutId, payload.checkoutId)))
        .limit(1);

      const paidAt = new Date(payload.paidAt);
      if (existingPayment) {
        await tx
          .update(ticketPayments)
          .set({
            status: "paid",
            providerPaymentId: payload.paymentId,
            providerTxId: payload.txId ?? null,
            paidAt,
            rawEvent: payload,
            updatedAt: new Date(),
          })
          .where(eq(ticketPayments.id, existingPayment.id));
      } else {
        await tx.insert(ticketPayments).values({
          reservationId: reservation.id,
          provider: payload.provider,
          providerPaymentId: payload.paymentId,
          providerTxId: payload.txId ?? null,
          checkoutId: payload.checkoutId,
          status: "paid",
          amount: payload.amount,
          currency: payload.currency,
          paidAt,
          rawEvent: payload,
        });
      }
    });

    return Response.json({ ok: true, rsvpId });
  } catch (err) {
    if (err instanceof Response) return err;
    throw err;
  }
};
