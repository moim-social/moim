import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { eq } from "drizzle-orm";
import { db } from "../db/client";
import { ticketReservations } from "../db/schema";

export type TicketReservation = InferSelectModel<typeof ticketReservations>;
export type NewTicketReservation = InferInsertModel<typeof ticketReservations>;

export async function insert(values: NewTicketReservation): Promise<TicketReservation> {
  const [row] = await db.insert(ticketReservations).values(values).returning();
  return row;
}

export async function findById(id: string): Promise<TicketReservation | undefined> {
  const [row] = await db
    .select()
    .from(ticketReservations)
    .where(eq(ticketReservations.id, id))
    .limit(1);
  return row;
}

export async function setCheckoutId(id: string, checkoutId: string): Promise<TicketReservation | undefined> {
  const [row] = await db
    .update(ticketReservations)
    .set({ checkoutId, updatedAt: new Date() })
    .where(eq(ticketReservations.id, id))
    .returning();
  return row;
}

export async function markConfirmed(id: string, rsvpId: string): Promise<TicketReservation | undefined> {
  const [row] = await db
    .update(ticketReservations)
    .set({ status: "confirmed", rsvpId, updatedAt: new Date() })
    .where(eq(ticketReservations.id, id))
    .returning();
  return row;
}
