import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { db } from "~/server/db/client";
import { sessions, users, userFediverseAccounts } from "~/server/db/schema";
import { toProxyHandle } from "~/server/fediverse/handles";
import { verifyAndConsumeHackersPubSession } from "~/server/hackerspub-sessions";

export const POST = async ({ request }: { request: Request }) => {
  const body = (await request.json().catch(() => null)) as {
    token?: string;
    code?: string;
    state?: string;
  } | null;

  if (!body?.token) {
    return Response.json({ error: "token is required" }, { status: 400 });
  }
  if (!body?.code) {
    return Response.json({ error: "code is required" }, { status: 400 });
  }
  if (!body?.state) {
    return Response.json({ error: "state is required" }, { status: 400 });
  }

  const { token, code, state } = body;

  // Verify session was created by this server
  const session = verifyAndConsumeHackersPubSession(state);
  if (!session) {
    console.warn("[HackersPub Callback] Session verification failed", {
      state,
    });
    return Response.json(
      { error: "invalid_session", reason: "session_expired" },
      { status: 401 },
    );
  }

  const { instance, username } = session;

  try {
    // Complete the login challenge via GraphQL
    const graphqlUrl = `https://${instance}/graphql`;

    const challengeRes = await fetch(graphqlUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: `
          mutation CompleteLoginChallenge($token: UUID!, $code: String!) {
            completeLoginChallenge(token: $token, code: $code) {
              id
              account {
                username
                handle
                name
                avatarUrl
              }
            }
          }
        `,
        variables: { token, code },
      }),
    });

    if (!challengeRes.ok) {
      console.error(
        "[HackersPub Callback] GraphQL request failed",
        challengeRes.status,
      );
      return Response.json(
        { error: "challenge_verification_failed" },
        { status: 401 },
      );
    }

    const challengeData = await challengeRes.json();
    const hpSession = challengeData?.data?.completeLoginChallenge;

    if (!hpSession) {
      const gqlError =
        challengeData?.errors?.[0]?.message ?? "challenge failed";
      console.error("[HackersPub Callback] Challenge failed:", gqlError);
      return Response.json(
        { error: "challenge_failed", message: gqlError },
        { status: 401 },
      );
    }

    // Extract user info from the session response
    const hpAccount = hpSession.account;
    const hpUsername = hpAccount?.username ?? username;
    const displayName = hpAccount?.name ?? hpUsername;
    const avatarUrl = hpAccount?.avatarUrl ?? null;

    // Build the fediverse handle
    const handle = `${hpUsername}@${instance}`;
    const proxyHandle = toProxyHandle(handle);

    // Find or create user (same pattern as Mastodon/Misskey)
    let user: typeof users.$inferSelect | undefined;

    // Check userFediverseAccounts for existing link
    const [linked] = await db
      .select({ userId: userFediverseAccounts.userId })
      .from(userFediverseAccounts)
      .where(eq(userFediverseAccounts.fediverseHandle, handle))
      .limit(1);

    if (linked) {
      const [found] = await db
        .select()
        .from(users)
        .where(eq(users.id, linked.userId))
        .limit(1);
      user = found;
    }

    // Check legacy users.fediverseHandle
    if (!user) {
      const [legacyUser] = await db
        .select()
        .from(users)
        .where(eq(users.fediverseHandle, handle))
        .limit(1);

      if (legacyUser) {
        await db.transaction(async (tx) => {
          await tx
            .insert(userFediverseAccounts)
            .values({
              userId: legacyUser.id,
              fediverseHandle: handle,
              proxyHandle,
              isPrimary: true,
            })
            .onConflictDoNothing();
        });
        user = legacyUser;
      }
    }

    // Create new user
    if (!user) {
      await db.transaction(async (tx) => {
        const [created] = await tx
          .insert(users)
          .values({
            handle: proxyHandle,
            fediverseHandle: handle,
            displayName,
            avatarUrl,
            summary: null,
          })
          .returning();

        await tx.insert(userFediverseAccounts).values({
          userId: created.id,
          fediverseHandle: handle,
          proxyHandle,
          isPrimary: true,
        });

        user = created;
      });
    }

    if (!user) {
      throw new Error("Failed to find or create user");
    }

    // Create Moim session
    const sessionToken = randomUUID().replace(/-/g, "");
    await db.insert(sessions).values({
      userId: user.id,
      token: sessionToken,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });

    const headers = new Headers();
    headers.set(
      "Set-Cookie",
      `session_token=${sessionToken}; HttpOnly; Secure; Path=/; Max-Age=${30 * 24 * 60 * 60}; SameSite=Lax`,
    );

    return new Response(
      JSON.stringify({
        ok: true,
        user: { id: user.id, handle: user.fediverseHandle ?? user.handle },
        returnTo: session.returnTo,
      }),
      { status: 200, headers },
    );
  } catch (error) {
    console.error("[HackersPub Callback] Error:", error);
    return Response.json({ error: "server_error" }, { status: 500 });
  }
};
