import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { and, eq } from "drizzle-orm";
import { db } from "../db/client";
import { ticketPayments } from "../db/schema";

export type TicketPayment = InferSelectModel<typeof ticketPayments>;
export type NewTicketPayment = InferInsertModel<typeof ticketPayments>;

export async function insert(values: NewTicketPayment): Promise<TicketPayment> {
  const [row] = await db.insert(ticketPayments).values(values).returning();
  return row;
}

export async function findByReservationAndCheckout(
  reservationId: string,
  checkoutId: string,
): Promise<TicketPayment | undefined> {
  const [row] = await db
    .select()
    .from(ticketPayments)
    .where(and(eq(ticketPayments.reservationId, reservationId), eq(ticketPayments.checkoutId, checkoutId)))
    .limit(1);
  return row;
}

export async function markPaid(
  reservationId: string,
  values: {
    checkoutId: string;
    providerPaymentId: string;
    providerTxId?: string | null;
    amount: number;
    currency: string;
    provider: string;
    paidAt: Date;
    rawEvent: unknown;
  },
): Promise<TicketPayment> {
  const existing = await findByReservationAndCheckout(reservationId, values.checkoutId);

  if (existing) {
    const [row] = await db
      .update(ticketPayments)
      .set({
        status: "paid",
        providerPaymentId: values.providerPaymentId,
        providerTxId: values.providerTxId ?? null,
        paidAt: values.paidAt,
        rawEvent: values.rawEvent,
        updatedAt: new Date(),
      })
      .where(eq(ticketPayments.id, existing.id))
      .returning();
    return row;
  }

  return insert({
    reservationId,
    checkoutId: values.checkoutId,
    provider: values.provider,
    providerPaymentId: values.providerPaymentId,
    providerTxId: values.providerTxId ?? null,
    status: "paid",
    amount: values.amount,
    currency: values.currency,
    paidAt: values.paidAt,
    rawEvent: values.rawEvent,
  });
}
