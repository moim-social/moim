import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { db } from "~/server/db/client";
import { sessions, users, userFediverseAccounts } from "~/server/db/schema";
import { toProxyHandle } from "~/server/fediverse/handles";
import { env } from "~/server/env";
import { verifyAndConsumeOAuthSession, evictOAuthApp } from "~/server/mastodon-oauth-sessions";

export const POST = async ({ request }: { request: Request }) => {
  const body = (await request.json().catch(() => null)) as {
    code?: string;
    state?: string;
  } | null;

  if (!body?.code) {
    return Response.json({ error: "code is required" }, { status: 400 });
  }

  if (!body?.state) {
    return Response.json({ error: "state is required" }, { status: 400 });
  }

  const { code, state } = body;

  const sessionVerification = verifyAndConsumeOAuthSession(state);
  if (!sessionVerification.valid || !sessionVerification.session) {
    const reason = sessionVerification.reason || "unknown";
    console.warn(`[Mastodon OAuth] Session verification failed: ${reason}`, { state });
    return Response.json({ error: "invalid_session", reason }, { status: 401 });
  }

  const { instance, clientId, clientSecret } = sessionVerification.session;

  try {
    // Token exchange
    const redirectUri = `${env.baseUrl}/auth/mastodon/oauth-callback`;

    const tokenController = new AbortController();
    const tokenTimeoutId = setTimeout(() => tokenController.abort(), 10000);

    let tokenRes: Response;
    try {
      tokenRes = await fetch(`https://${instance}/oauth/token`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          code,
          grant_type: "authorization_code",
          redirect_uri: redirectUri,
        }),
        signal: tokenController.signal,
      });
      clearTimeout(tokenTimeoutId);
    } catch (fetchError) {
      clearTimeout(tokenTimeoutId);
      if (fetchError instanceof Error && fetchError.name === "AbortError") {
        return Response.json({ error: "token_exchange_timeout" }, { status: 502 });
      }
      throw fetchError;
    }

    if (!tokenRes.ok) {
      // If 401, the cached app credentials may be stale
      if (tokenRes.status === 401) {
        evictOAuthApp(instance);
      }
      console.error(
        `[Mastodon OAuth] Token exchange returned ${tokenRes.status}`,
        { status: tokenRes.status, instance },
      );
      return Response.json({ error: "token_exchange_failed" }, { status: 401 });
    }

    const tokenData = await tokenRes.json() as { access_token?: string };
    if (!tokenData.access_token) {
      return Response.json({ error: "token_exchange_failed" }, { status: 401 });
    }

    const accessToken = tokenData.access_token;

    // Verify credentials
    const verifyController = new AbortController();
    const verifyTimeoutId = setTimeout(() => verifyController.abort(), 10000);

    let verifyRes: Response;
    try {
      verifyRes = await fetch(`https://${instance}/api/v1/accounts/verify_credentials`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: verifyController.signal,
      });
      clearTimeout(verifyTimeoutId);
    } catch (fetchError) {
      clearTimeout(verifyTimeoutId);
      if (fetchError instanceof Error && fetchError.name === "AbortError") {
        return Response.json({ error: "verify_timeout" }, { status: 502 });
      }
      throw fetchError;
    }

    if (!verifyRes.ok) {
      return Response.json({ error: "verify_failed" }, { status: 401 });
    }

    const account = await verifyRes.json() as {
      username: string;
      acct: string;
      display_name?: string;
      avatar?: string;
    };

    if (!account.username) {
      return Response.json({ error: "invalid_account" }, { status: 401 });
    }

    const handle = `${account.username}@${instance}`;
    const proxyHandle = toProxyHandle(handle);

    // Find or create user (same pattern as miauth-callback-api.ts)
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

    // Check for legacy user with fediverseHandle
    if (!user) {
      const [legacyUser] = await db
        .select()
        .from(users)
        .where(eq(users.fediverseHandle, handle))
        .limit(1);

      if (legacyUser) {
        await db.transaction(async (tx) => {
          await tx.insert(userFediverseAccounts).values({
            userId: legacyUser.id,
            fediverseHandle: handle,
            proxyHandle,
            isPrimary: true,
          }).onConflictDoNothing();
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
            displayName: account.display_name || account.username,
            avatarUrl: account.avatar ?? null,
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

    // Create session
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
      JSON.stringify({ ok: true, user: { id: user.id, handle: user.fediverseHandle ?? user.handle } }),
      { status: 200, headers },
    );
  } catch (error) {
    console.error("[Mastodon OAuth] Error:", error);
    return Response.json({ error: "server_error" }, { status: 500 });
  }
};
