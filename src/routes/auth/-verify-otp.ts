import { and, desc, eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import { db } from "~/server/db/client";
import { actors, otpChallenges, otpVotes, sessions, users } from "~/server/db/schema";

export const POST = async ({ request }: { request: Request }) => {
  const body = (await request.json().catch(() => null)) as {
    handle?: string;
    challengeId?: string;
  } | null;

  if (!body?.handle) {
    return Response.json({ error: "handle is required" }, { status: 400 });
  }

  const handle = body.handle.startsWith("@") ? body.handle.slice(1) : body.handle;

  // Look up the challenge (by ID if provided, otherwise most recent pending)
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
    return Response.json({ error: "challenge already verified" }, { status: 409 });
  }

  if (challenge.status === "expired") {
    return Response.json({ error: "challenge expired" }, { status: 410 });
  }

  // Check received votes against expected emojis
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

  // Verified! Mark challenge and create session
  await db
    .update(otpChallenges)
    .set({ status: "verified" })
    .where(eq(otpChallenges.id, challenge.id));

  // Find or create user
  const [actor] = await db
    .select()
    .from(actors)
    .where(eq(actors.handle, handle))
    .limit(1);

  let [user] = await db
    .select()
    .from(users)
    .where(eq(users.handle, handle))
    .limit(1);

  if (!user) {
    const [created] = await db
      .insert(users)
      .values({
        handle: handle,
        displayName: actor?.name ?? handle,
        summary: actor?.summary,
      })
      .returning();
    user = created;
  }

  // Link actor to user
  if (actor && !actor.userId) {
    await db
      .update(actors)
      .set({ userId: user.id, updatedAt: new Date() })
      .where(eq(actors.id, actor.id));
  }

  const sessionToken = randomUUID().replace(/-/g, "");
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  await db.insert(sessions).values({
    userId: user.id,
    token: sessionToken,
    expiresAt,
  });

  const headers = new Headers();
  headers.set(
    "Set-Cookie",
    `session_token=${sessionToken}; HttpOnly; Path=/; Max-Age=${30 * 24 * 60 * 60}; SameSite=Lax`,
  );

  return new Response(
    JSON.stringify({ ok: true, user: { id: user.id, handle: user.handle } }),
    { headers, status: 200 },
  );
};
