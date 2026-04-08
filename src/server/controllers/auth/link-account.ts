import { and, eq, sql } from "drizzle-orm";
import { getSessionUser } from "~/server/auth";
import { db } from "~/server/db/client";
import {
  actors,
  checkins,
  events,
  otpChallenges,
  userFediverseAccounts,
} from "~/server/db/schema";
import { toProxyHandle } from "~/server/fediverse/handles";

export const POST = async ({ request }: { request: Request }) => {
  const user = await getSessionUser(request);
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    challengeId?: string;
    handle?: string;
  } | null;

  if (!body?.challengeId || !body?.handle) {
    return Response.json(
      { error: "challengeId and handle are required" },
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

  // Check if handle is already linked
  const [existing] = await db
    .select({
      userId: userFediverseAccounts.userId,
    })
    .from(userFediverseAccounts)
    .where(eq(userFediverseAccounts.fediverseHandle, handle))
    .limit(1);

  if (existing) {
    if (existing.userId === user.id) {
      return Response.json(
        { error: "Account already linked to your identity" },
        { status: 409 },
      );
    }

    // Handle belongs to a different user — offer merge
    const sourceUserId = existing.userId;

    // Gather merge preview data
    const [checkinCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(checkins)
      .where(eq(checkins.userId, sourceUserId));

    const [eventCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(events)
      .where(eq(events.organizerId, sourceUserId));

    const sourceAccounts = await db
      .select({
        fediverseHandle: userFediverseAccounts.fediverseHandle,
      })
      .from(userFediverseAccounts)
      .where(eq(userFediverseAccounts.userId, sourceUserId));

    return Response.json(
      {
        mergeRequired: true,
        sourceUserId,
        preview: {
          checkins: checkinCount?.count ?? 0,
          events: eventCount?.count ?? 0,
          accounts: sourceAccounts.map((a) => a.fediverseHandle),
        },
      },
      { status: 200 },
    );
  }

  // Not linked to anyone — link to current user
  const proxyHandle = toProxyHandle(handle);

  await db.insert(userFediverseAccounts).values({
    userId: user.id,
    fediverseHandle: handle,
    proxyHandle,
    isPrimary: false,
  });

  // Link the remote actor to this user if not already linked
  const [remoteActor] = await db
    .select({ id: actors.id, userId: actors.userId })
    .from(actors)
    .where(eq(actors.handle, handle))
    .limit(1);

  if (remoteActor && !remoteActor.userId) {
    await db
      .update(actors)
      .set({ userId: user.id, updatedAt: new Date() })
      .where(eq(actors.id, remoteActor.id));
  }

  return Response.json({ ok: true });
};
