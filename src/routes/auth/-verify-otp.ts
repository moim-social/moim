import { and, desc, eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import { db } from "~/server/db/client";
import { actors, otpChallenges, sessions, users } from "~/server/db/schema";
import { env } from "~/server/env";
import { fetchOutboxContent, contentContainsOtp } from "~/server/fediverse/outbox";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const POST = async ({ request }: { request: Request }) => {
  const body = (await request.json().catch(() => null)) as {
    handle?: string;
  } | null;

  if (!body?.handle) {
    return Response.json({ error: "handle is required" }, { status: 400 });
  }

  const handle = body.handle.startsWith("@") ? body.handle.slice(1) : body.handle;

  const [challenge] = await db
    .select()
    .from(otpChallenges)
    .where(and(eq(otpChallenges.handle, handle), eq(otpChallenges.status, "pending")))
    .orderBy(desc(otpChallenges.createdAt))
    .limit(1);

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

  // Use persisted actor's outbox URL instead of re-resolving
  const [actor] = await db
    .select()
    .from(actors)
    .where(eq(actors.handle, handle))
    .limit(1);

  if (!actor?.outboxUrl) {
    return Response.json(
      { error: "Actor not found. Call /auth/request-otp first." },
      { status: 400 },
    );
  }

  const start = Date.now();
  let verified = false;

  while (Date.now() - start < env.otpPollTimeoutMs) {
    const contents = await fetchOutboxContent(actor.outboxUrl);
    if (contentContainsOtp(contents, challenge.otp)) {
      verified = true;
      break;
    }
    await sleep(env.otpPollIntervalMs);
  }

  if (!verified) {
    return Response.json({ error: "OTP not found in outbox" }, { status: 400 });
  }

  await db
    .update(otpChallenges)
    .set({ status: "verified" })
    .where(eq(otpChallenges.id, challenge.id));

  // Find or create user
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
        displayName: actor.name ?? handle,
        summary: actor.summary,
      })
      .returning();
    user = created;
  }

  // Link actor to user (signing as Person actor)
  if (!actor.userId) {
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
