import { randomUUID } from "crypto";
import { env } from "~/server/env";
import { validateInstanceHostname } from "~/server/miauth-sessions";
import { getOrRegisterOAuthApp, createOAuthSession } from "~/server/mastodon-oauth-sessions";

export const POST = async ({ request }: { request: Request }) => {
  const body = await request.json().catch(() => null) as { instance?: string; returnTo?: string } | null;

  if (!body?.instance) {
    return Response.json({ error: "instance is required" }, { status: 400 });
  }

  const instance = body.instance.replace(/^https?:\/\//, "").replace(/\/$/, "");

  if (!validateInstanceHostname(instance)) {
    return Response.json({ error: "invalid_instance" }, { status: 400 });
  }

  let app;
  try {
    app = await getOrRegisterOAuthApp(instance);
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    return Response.json({ error: message }, { status: 400 });
  }

  const state = randomUUID();
  const ttlSecondsEnv = parseInt(process.env.MASTODON_OAUTH_SESSION_TTL_SECONDS ?? "300", 10);
  const ttlSeconds = isFinite(ttlSecondsEnv) && ttlSecondsEnv > 0 ? ttlSecondsEnv : 300;
  createOAuthSession(state, instance, app.clientId, app.clientSecret, ttlSeconds, body.returnTo);

  const redirectUri = `${env.baseUrl}/auth/mastodon/oauth-callback`;

  const authorizeUrl = new URL(`https://${instance}/oauth/authorize`);
  authorizeUrl.searchParams.set("client_id", app.clientId);
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("scope", "read:accounts");
  authorizeUrl.searchParams.set("state", state);

  return Response.json({ redirectUrl: authorizeUrl.toString() });
};
