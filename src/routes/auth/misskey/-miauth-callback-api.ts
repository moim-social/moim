import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { db } from "~/server/db/client";
import { sessions, users, userFediverseAccounts } from "~/server/db/schema";
import { toProxyHandle } from "~/server/fediverse/handles";

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

  try {
    const checkRes = await fetch(`https://${instance}/api/miauth/${sessionId}/check`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    if (!checkRes.ok) {
      const errorText = await checkRes.text();
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

    const handle = mkUser.host
      ? `${mkUser.username}@${mkUser.host}`
      : `${mkUser.username}@${instance}`;

    const proxyHandle = toProxyHandle(handle);

    // Find or create user
    const [linked] = await db
      .select({ userId: userFediverseAccounts.userId })
      .from(userFediverseAccounts)
      .where(eq(userFediverseAccounts.fediverseHandle, handle))
      .limit(1);

    let [user] = linked
      ? await db.select().from(users).where(eq(users.id, linked.userId)).limit(1)
      : [];

    if (!user) {
      const [created] = await db
        .insert(users)
        .values({
          handle: proxyHandle,
          fediverseHandle: handle,
          displayName: mkUser.name ?? mkUser.username,
          avatarUrl: mkUser.avatarUrl ?? null,
          summary: null,
        })
        .returning();
      user = created;

      await db.insert(userFediverseAccounts).values({
        userId: user.id,
        fediverseHandle: handle,
        proxyHandle,
        isPrimary: true,
      });
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
      `session_token=${sessionToken}; HttpOnly; Path=/; Max-Age=${30 * 24 * 60 * 60}; SameSite=Lax`
    );

    return new Response(
      JSON.stringify({ ok: true, user: { id: user.id, handle: user.fediverseHandle ?? user.handle } }),
      { status: 200, headers }
    );
  } catch (error) {
    console.error("[MiAuth Callback] Error:", error);
    return Response.json({ error: "server_error", details: String(error) }, { status: 500 });
  }
};
