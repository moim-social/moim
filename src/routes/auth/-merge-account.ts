import { and, eq, notInArray } from "drizzle-orm";
import { getSessionUser } from "~/server/auth";
import { db } from "~/server/db/client";
import {
  actors,
  checkins,
  events,
  groupPlaces,
  otpChallenges,
  placeAuditLog,
  places,
  rsvpAnswers,
  rsvps,
  sessions,
  userFediverseAccounts,
  users,
} from "~/server/db/schema";

export const POST = async ({ request }: { request: Request }) => {
  const user = await getSessionUser(request);
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    challengeId?: string;
    handle?: string;
    sourceUserId?: string;
  } | null;

  if (!body?.challengeId || !body?.handle || !body?.sourceUserId) {
    return Response.json(
      { error: "challengeId, handle, and sourceUserId are required" },
      { status: 400 },
    );
  }

  const handle = body.handle.startsWith("@")
    ? body.handle.slice(1)
    : body.handle;

  // Verify the challenge was completed
  const [challenge] = await db
    .select()
    .from(otpChallenges)
    .where(
      and(
        eq(otpChallenges.id, body.challengeId),
        eq(otpChallenges.handle, handle),
        eq(otpChallenges.status, "verified"),
      ),
    )
    .limit(1);

  if (!challenge) {
    return Response.json(
      { error: "No verified challenge found" },
      { status: 400 },
    );
  }

  // Verify source user exists and handle belongs to them
  const [sourceAccount] = await db
    .select()
    .from(userFediverseAccounts)
    .where(
      and(
        eq(userFediverseAccounts.userId, body.sourceUserId),
        eq(userFediverseAccounts.fediverseHandle, handle),
      ),
    )
    .limit(1);

  if (!sourceAccount) {
    return Response.json(
      { error: "Source account not found" },
      { status: 404 },
    );
  }

  const targetUserId = user.id;
  const sourceUserId = body.sourceUserId;

  if (targetUserId === sourceUserId) {
    return Response.json(
      { error: "Cannot merge with yourself" },
      { status: 400 },
    );
  }

  // Perform merge in a transaction
  await db.transaction(async (tx) => {
    // 1. Reassign actors
    await tx
      .update(actors)
      .set({ userId: targetUserId, updatedAt: new Date() })
      .where(eq(actors.userId, sourceUserId));

    // 2. Reassign events
    await tx
      .update(events)
      .set({ organizerId: targetUserId })
      .where(eq(events.organizerId, sourceUserId));

    // 3. Reassign checkins
    await tx
      .update(checkins)
      .set({ userId: targetUserId })
      .where(eq(checkins.userId, sourceUserId));

    // 4. Reassign rsvps (skip conflicts — target already RSVPed same event)
    const targetRsvpEventIds = (
      await tx
        .select({ eventId: rsvps.eventId })
        .from(rsvps)
        .where(eq(rsvps.userId, targetUserId))
    ).map((r) => r.eventId);

    if (targetRsvpEventIds.length > 0) {
      // Only transfer RSVPs for events the target hasn't already RSVPed
      await tx
        .update(rsvps)
        .set({ userId: targetUserId })
        .where(
          and(
            eq(rsvps.userId, sourceUserId),
            notInArray(rsvps.eventId, targetRsvpEventIds),
          ),
        );
      // Delete conflicting RSVPs from source
      await tx.delete(rsvps).where(eq(rsvps.userId, sourceUserId));
    } else {
      await tx
        .update(rsvps)
        .set({ userId: targetUserId })
        .where(eq(rsvps.userId, sourceUserId));
    }

    // 5. Reassign rsvp answers (skip conflicts)
    const targetAnswerKeys = (
      await tx
        .select({
          eventId: rsvpAnswers.eventId,
          questionId: rsvpAnswers.questionId,
        })
        .from(rsvpAnswers)
        .where(eq(rsvpAnswers.userId, targetUserId))
    );

    if (targetAnswerKeys.length > 0) {
      // Delete conflicting answers from source first
      for (const key of targetAnswerKeys) {
        await tx.delete(rsvpAnswers).where(
          and(
            eq(rsvpAnswers.userId, sourceUserId),
            eq(rsvpAnswers.eventId, key.eventId),
            eq(rsvpAnswers.questionId, key.questionId),
          ),
        );
      }
    }
    await tx
      .update(rsvpAnswers)
      .set({ userId: targetUserId })
      .where(eq(rsvpAnswers.userId, sourceUserId));

    // 6. Reassign places
    await tx
      .update(places)
      .set({ createdById: targetUserId })
      .where(eq(places.createdById, sourceUserId));

    // 7. Reassign group places
    await tx
      .update(groupPlaces)
      .set({ assignedByUserId: targetUserId })
      .where(eq(groupPlaces.assignedByUserId, sourceUserId));

    // 8. Reassign audit log
    await tx
      .update(placeAuditLog)
      .set({ userId: targetUserId })
      .where(eq(placeAuditLog.userId, sourceUserId));

    // 9. Delete source user's sessions
    await tx.delete(sessions).where(eq(sessions.userId, sourceUserId));

    // 10. Move source user's fediverse accounts to target user
    await tx
      .update(userFediverseAccounts)
      .set({ userId: targetUserId, isPrimary: false })
      .where(eq(userFediverseAccounts.userId, sourceUserId));

    // 11. Delete the source user
    await tx.delete(users).where(eq(users.id, sourceUserId));
  });

  return Response.json({ ok: true });
};
