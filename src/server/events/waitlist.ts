import { eq, and, sql, asc } from "drizzle-orm";
import type { PgTransaction } from "drizzle-orm/pg-core";
import { rsvps, eventTiers } from "~/server/db/schema";

type Tx = PgTransaction<any, any, any>;

/**
 * Count accepted RSVPs for a given tier.
 */
export async function getAcceptedCount(tx: Tx, tierId: string): Promise<number> {
  const [row] = await tx
    .select({ count: sql<number>`count(*)::int` })
    .from(rsvps)
    .where(and(eq(rsvps.tierId, tierId), eq(rsvps.status, "accepted")));
  return row?.count ?? 0;
}

/**
 * Promote the oldest waitlisted RSVPs for a tier to "accepted".
 * If spotsToFill is omitted, promotes all waitlisted RSVPs.
 */
export async function autoPromoteWaitlist(
  tx: Tx,
  tierId: string,
  spotsToFill?: number,
): Promise<number> {
  // Find waitlisted RSVPs ordered by createdAt (FIFO)
  const waitlisted = await tx
    .select({ id: rsvps.id })
    .from(rsvps)
    .where(and(eq(rsvps.tierId, tierId), eq(rsvps.status, "waitlisted")))
    .orderBy(asc(rsvps.createdAt))
    .limit(spotsToFill ?? 1000);

  const toPromote = spotsToFill != null ? waitlisted.slice(0, spotsToFill) : waitlisted;

  for (const r of toPromote) {
    await tx
      .update(rsvps)
      .set({ status: "accepted" })
      .where(eq(rsvps.id, r.id));
  }

  return toPromote.length;
}

/**
 * Get the tier's capacity. Returns null for unlimited.
 */
export async function getTierCapacity(tx: Tx, tierId: string): Promise<number | null> {
  const [tier] = await tx
    .select({ capacity: eventTiers.capacity })
    .from(eventTiers)
    .where(eq(eventTiers.id, tierId))
    .limit(1);
  return tier?.capacity ?? null;
}
