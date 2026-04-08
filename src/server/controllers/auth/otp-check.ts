import { and, desc, eq } from "drizzle-orm";
import { db } from "~/server/db/client";
import { otpChallenges, otpVotes } from "~/server/db/schema";

/**
 * Lightweight OTP verification that only checks votes and marks the challenge
 * as verified — does NOT create a session or log the user in.
 * Used by the link-account flow to avoid overwriting the current session.
 */
export const POST = async ({ request }: { request: Request }) => {
  const body = (await request.json().catch(() => null)) as {
    handle?: string;
    challengeId?: string;
  } | null;

  if (!body?.handle) {
    return Response.json({ error: "handle is required" }, { status: 400 });
  }

  const handle = body.handle.startsWith("@") ? body.handle.slice(1) : body.handle;

  let challenge;
  if (body.challengeId) {
    const [row] = await db
      .select()
      .from(otpChallenges)
      .where(
        and(
          eq(otpChallenges.id, body.challengeId),
          eq(otpChallenges.handle, handle),
        ),
      )
      .limit(1);
    challenge = row;
  } else {
    const [row] = await db
      .select()
      .from(otpChallenges)
      .where(and(eq(otpChallenges.handle, handle), eq(otpChallenges.status, "pending")))
      .orderBy(desc(otpChallenges.createdAt))
      .limit(1);
    challenge = row;
  }

  if (!challenge) {
    return Response.json({ error: "no pending challenge" }, { status: 404 });
  }

  if (new Date(challenge.expiresAt).getTime() < Date.now()) {
    await db
      .update(otpChallenges)
      .set({ status: "expired" })
      .where(eq(otpChallenges.id, challenge.id));
    return Response.json({ error: "challenge expired" }, { status: 410 });
  }

  if (challenge.status === "verified") {
    return Response.json({ ok: true });
  }

  if (challenge.status === "expired") {
    return Response.json({ error: "challenge expired" }, { status: 410 });
  }

  const votes = await db
    .select({ emoji: otpVotes.emoji })
    .from(otpVotes)
    .where(eq(otpVotes.challengeId, challenge.id));

  const votedSet = new Set(votes.map((v) => v.emoji));
  const expectedSet = new Set(challenge.expectedEmojis as string[]);

  const isMatch =
    votedSet.size === expectedSet.size &&
    [...votedSet].every((e) => expectedSet.has(e));

  if (!isMatch) {
    return Response.json({ status: "waiting" }, { status: 202 });
  }

  // Mark challenge as verified — no session creation
  await db
    .update(otpChallenges)
    .set({ status: "verified" })
    .where(eq(otpChallenges.id, challenge.id));

  return Response.json({ ok: true });
};
