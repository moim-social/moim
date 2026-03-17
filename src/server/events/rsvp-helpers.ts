import { eq, and, sql } from "drizzle-orm";
import type { PgTransaction } from "drizzle-orm/pg-core";
import { db } from "~/server/db/client";
import { eventTiers, eventQuestions, rsvps } from "~/server/db/schema";

type Tx = PgTransaction<any, any, any>;

/**
 * Resolve the tier for an RSVP submission.
 * Returns { tierId, capacity } or a Response error.
 */
export async function resolveTier(
  eventId: string,
  tierId: string | undefined,
  eventStartsAt: Date,
): Promise<{ tierId: string | null; capacity: number | null } | Response> {
  const tiers = await db
    .select({
      id: eventTiers.id,
      opensAt: eventTiers.opensAt,
      closesAt: eventTiers.closesAt,
      capacity: eventTiers.capacity,
    })
    .from(eventTiers)
    .where(eq(eventTiers.eventId, eventId))
    .orderBy(eventTiers.sortOrder);

  if (tiers.length === 0) {
    return { tierId: null, capacity: null };
  }

  if (tierId) {
    const tier = tiers.find((t) => t.id === tierId);
    if (!tier) {
      return Response.json({ error: "Invalid tier for this event" }, { status: 400 });
    }
    const now = new Date();
    if (tier.opensAt && now < tier.opensAt) {
      return Response.json({ error: "This tier is not yet open for registration" }, { status: 400 });
    }
    const closesAt = tier.closesAt ?? eventStartsAt;
    if (now > closesAt) {
      return Response.json({ error: "This tier is no longer open for registration" }, { status: 400 });
    }
    return { tierId: tier.id, capacity: tier.capacity };
  } else if (tiers.length === 1) {
    const tier = tiers[0];
    const now = new Date();
    if (tier.opensAt && now < tier.opensAt) {
      return Response.json({ error: "Registration is not yet open" }, { status: 400 });
    }
    const closesAt = tier.closesAt ?? eventStartsAt;
    if (now > closesAt) {
      return Response.json({ error: "Registration is closed" }, { status: 400 });
    }
    return { tierId: tier.id, capacity: tier.capacity };
  } else {
    return Response.json({ error: "tierId is required for multi-tier events" }, { status: 400 });
  }
}

/**
 * Validate that all required questions are answered.
 * Returns null if valid, or a Response error.
 */
export async function validateRequiredAnswers(
  eventId: string,
  answers: Array<{ questionId: string; answer: string }> | undefined,
): Promise<Response | null> {
  const questions = await db
    .select({ id: eventQuestions.id, required: eventQuestions.required })
    .from(eventQuestions)
    .where(eq(eventQuestions.eventId, eventId));

  const validIds = new Set(questions.map((q) => q.id));
  const requiredIds = new Set(
    questions.filter((q) => q.required).map((q) => q.id),
  );
  const answeredIds = new Set(
    (answers ?? []).filter((a) => a.answer.trim()).map((a) => a.questionId),
  );

  for (const id of answeredIds) {
    if (!validIds.has(id)) {
      return Response.json(
        { error: "Answer references an invalid question" },
        { status: 400 },
      );
    }
  }

  for (const reqId of requiredIds) {
    if (!answeredIds.has(reqId)) {
      return Response.json(
        { error: "All required questions must be answered" },
        { status: 400 },
      );
    }
  }

  return null;
}

/**
 * Check tier capacity and determine effective status.
 * @param excludeRsvpId - If re-registering, exclude this RSVP from the count.
 */
export async function checkCapacityAndDetermineStatus(
  tx: Tx,
  tierId: string,
  capacity: number,
  excludeRsvpId?: string,
): Promise<"accepted" | "waitlisted"> {
  // Lock the tier row to serialize concurrent capacity checks
  await tx.execute(sql`SELECT id FROM event_tiers WHERE id = ${tierId} FOR UPDATE`);

  const [countRow] = await tx
    .select({ count: sql<number>`count(*)::int` })
    .from(rsvps)
    .where(
      and(
        eq(rsvps.tierId, tierId),
        eq(rsvps.status, "accepted"),
      ),
    );
  let acceptedCount = countRow?.count ?? 0;

  // Don't count the user's own existing accepted RSVP in this tier
  if (excludeRsvpId) {
    const [existing] = await tx
      .select({ status: rsvps.status, tierId: rsvps.tierId })
      .from(rsvps)
      .where(eq(rsvps.id, excludeRsvpId))
      .limit(1);

    if (existing?.status === "accepted" && existing.tierId === tierId) {
      acceptedCount--;
    }
  }

  return acceptedCount >= capacity ? "waitlisted" : "accepted";
}

const ALLOWED_CONTACT_MODES = new Set(["required", "optional", "hidden"]);

/**
 * Sanitize anonymousContactFields to only allow known keys and valid modes.
 */
export function sanitizeContactFields(
  fields: { email?: string; phone?: string } | null | undefined,
): { email: string; phone: string } | null {
  if (!fields) return null;
  const email = ALLOWED_CONTACT_MODES.has(fields.email as string) ? fields.email! : "optional";
  const phone = ALLOWED_CONTACT_MODES.has(fields.phone as string) ? fields.phone! : "hidden";
  return { email, phone };
}
