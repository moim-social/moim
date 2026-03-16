import { sql, and, eq, isNull, isNotNull } from "drizzle-orm";
import { db } from "~/server/db/client";
import { rsvps, rsvpAnswers, events } from "~/server/db/schema";

const RETENTION_DAYS = 30;
const NOTIFICATION_DAYS_BEFORE = 7;
const CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Purge PII from anonymous RSVPs for events that ended more than 30 days ago.
 * Keeps the RSVP row (with status) for aggregate counts but nullifies contact info.
 */
export async function purgeExpiredAnonymousPii(): Promise<number> {
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 86400000);

  // Find events past the retention window
  // Use endsAt if available, otherwise startsAt + 1 day
  const expiredEvents = await db
    .select({ id: events.id })
    .from(events)
    .where(
      sql`COALESCE(${events.endsAt}, ${events.startsAt} + interval '1 day') < ${cutoff}`,
    );

  if (expiredEvents.length === 0) return 0;

  const eventIds = expiredEvents.map((e) => e.id);
  let totalPurged = 0;

  for (const eventId of eventIds) {
    // Find anonymous RSVPs that still have PII (token not null = not yet purged)
    const anonRsvps = await db
      .select({ id: rsvps.id })
      .from(rsvps)
      .where(
        and(
          eq(rsvps.eventId, eventId),
          isNull(rsvps.userId),
          isNotNull(rsvps.token),
        ),
      );

    if (anonRsvps.length === 0) continue;

    const rsvpIds = anonRsvps.map((r) => r.id);

    // Delete answers for these RSVPs
    for (const rsvpId of rsvpIds) {
      await db.delete(rsvpAnswers).where(eq(rsvpAnswers.rsvpId, rsvpId));
    }

    // Null out PII on the RSVP rows
    for (const rsvpId of rsvpIds) {
      await db
        .update(rsvps)
        .set({
          token: null,
          displayName: null,
          email: null,
          phone: null,
        })
        .where(eq(rsvps.id, rsvpId));
    }

    totalPurged += rsvpIds.length;
  }

  if (totalPurged > 0) {
    console.log(`[GDPR] Purged PII from ${totalPurged} anonymous RSVPs`);
  }

  return totalPurged;
}

/**
 * Find events approaching the PII deletion deadline (7 days before).
 * Returns event IDs and organizer IDs for notification.
 */
export async function findEventsNearingDeletion(): Promise<
  Array<{ eventId: string; organizerId: string; title: string; deletionDate: Date }>
> {
  const notificationCutoff = new Date(
    Date.now() - (RETENTION_DAYS - NOTIFICATION_DAYS_BEFORE) * 86400000,
  );
  const retentionCutoff = new Date(Date.now() - RETENTION_DAYS * 86400000);

  // Events that ended between (now - 23 days) and (now - 30 days)
  // i.e., deletion is within the next 7 days
  const results = await db
    .select({
      eventId: events.id,
      organizerId: events.organizerId,
      title: events.title,
      endsAt: events.endsAt,
      startsAt: events.startsAt,
    })
    .from(events)
    .where(
      and(
        sql`COALESCE(${events.endsAt}, ${events.startsAt} + interval '1 day') < ${notificationCutoff}`,
        sql`COALESCE(${events.endsAt}, ${events.startsAt} + interval '1 day') >= ${retentionCutoff}`,
      ),
    );

  // Only include events that actually have anonymous RSVPs with PII
  const eventsWithAnonRsvps: typeof results = [];
  for (const event of results) {
    const [count] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(rsvps)
      .where(
        and(
          eq(rsvps.eventId, event.eventId),
          isNull(rsvps.userId),
          isNotNull(rsvps.token),
        ),
      );
    if ((count?.count ?? 0) > 0) {
      eventsWithAnonRsvps.push(event);
    }
  }

  return eventsWithAnonRsvps.map((e) => {
    const eventEnd = e.endsAt ?? new Date(e.startsAt.getTime() + 86400000);
    const deletionDate = new Date(eventEnd.getTime() + RETENTION_DAYS * 86400000);
    return {
      eventId: e.eventId,
      organizerId: e.organizerId,
      title: e.title,
      deletionDate,
    };
  });
}

/**
 * Start the periodic GDPR cleanup.
 * Runs immediately on startup, then every 24 hours.
 */
export function startGdprCleanupInterval(): void {
  async function run() {
    try {
      await purgeExpiredAnonymousPii();
    } catch (err) {
      console.error("[GDPR] Cleanup error:", err);
    }
  }

  // Run on startup (delayed to avoid blocking init)
  setTimeout(run, 5000);
  setInterval(run, CLEANUP_INTERVAL_MS);
}
