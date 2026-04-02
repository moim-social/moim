import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { db } from "~/server/db/client";
import { sessions, users, userFediverseAccounts } from "~/server/db/schema";
import { toProxyHandle } from "~/server/fediverse/handles";
import { verifyAndConsumeMiAuthSession, validateInstanceHostname } from "~/server/miauth-sessions";

export const POST = async ({ request }: { request: Request }) => {
  const body = (await request.json().catch(() => null)) as {
    session?: string;
    instance?: string;
  } | null;

  if (!body?.session) {
    return Response.json({ error: "session is required" }, { status: 400 });
  }

  if (!body?.instance) {
    return Response.json({ error: "instance is required" }, { status: 400 });
  }

  const { session: sessionId, instance } = body;

  // Validate instance hostname format to prevent SSRF
  if (!validateInstanceHostname(instance)) {
    return Response.json({ error: "invalid_instance" }, { status: 400 });
  }

  // Verify session was created by this server and matches the instance
  const sessionVerification = verifyAndConsumeMiAuthSession(sessionId, instance);
  if (!sessionVerification.valid) {
    const reason = sessionVerification.reason || "unknown";
    console.warn(`[MiAuth Callback] Session verification failed: ${reason}`, { sessionId, instance });
    return Response.json({ error: "invalid_session", reason }, { status: 401 });
  }

  try {
    const controller = new AbortController();
    const timeoutMs = 10000; // 10 seconds
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, timeoutMs);

    let checkRes: Response;
    try {
      checkRes = await fetch(`https://${instance}/api/miauth/${sessionId}/check`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
    } catch (fetchError) {
      clearTimeout(timeoutId);
      if (fetchError instanceof Error && fetchError.name === "AbortError") {
        return Response.json({ error: "miauth_failed" }, { status: 401 });
      }
      throw fetchError;
    }

    if (!checkRes.ok) {
      console.error(
        `[MiAuth Callback] Check endpoint returned ${checkRes.status}`,
        { status: checkRes.status, instance, sessionId }
      );
      return Response.json({ error: "miauth_failed" }, { status: 401 });
    }

    const checkData = await checkRes.json();

    const { ok, token, user: mkUser } = checkData as {
      ok: boolean;
      token?: string;
      user?: { username: string; host: string | null; name?: string; avatarUrl?: string };
    };

    if (!ok || !token || !mkUser) {
      return Response.json({ error: "not_authorized" }, { status: 401 });
    }

    const handle = `${mkUser.username}@${instance}`;

    const proxyHandle = toProxyHandle(handle);

    // Find or create user
    let user: typeof users.$inferSelect | undefined;

    // First check userFediverseAccounts for existing link
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

    // If not found via userFediverseAccounts, check for legacy user with fediverseHandle
    if (!user) {
      const [legacyUser] = await db
        .select()
        .from(users)
        .where(eq(users.fediverseHandle, handle))
        .limit(1);

      if (legacyUser) {
        // Backfill userFediverseAccounts for legacy user in transaction
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

    // If still not found, create new user with userFediverseAccounts in transaction
    if (!user) {
      await db.transaction(async (tx) => {
        const [created] = await tx
          .insert(users)
          .values({
            handle: proxyHandle,
            fediverseHandle: handle,
            displayName: mkUser.name ?? mkUser.username,
            avatarUrl: mkUser.avatarUrl ?? null,
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
      `session_token=${sessionToken}; HttpOnly; Secure; Path=/; Max-Age=${30 * 24 * 60 * 60}; SameSite=Lax`
    );

    return new Response(
      JSON.stringify({ ok: true, user: { id: user.id, handle: user.fediverseHandle ?? user.handle }, returnTo: sessionVerification.returnTo }),
      { status: 200, headers }
    );
  } catch (error) {
    console.error("[MiAuth Callback] Error:", error);
    return Response.json({ error: "server_error" }, { status: 500 });
  }
};
