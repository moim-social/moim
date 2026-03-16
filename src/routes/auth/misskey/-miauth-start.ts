import { randomUUID } from "crypto";
import { env } from "~/server/env";
import { createMiAuthSession, validateInstanceHostname } from "~/server/miauth-sessions";

export const POST = async ({ request }: { request: Request }) => {
  const body = await request.json().catch(() => null) as { instance?: string } | null;

  if (!body?.instance) {
    return Response.json({ error: "instance is required" }, { status: 400 });
  }

  const instance = body.instance.replace(/^https?:\/\//, "").replace(/\/$/, "");

  // Validate instance hostname format to prevent SSRF
  if (!validateInstanceHostname(instance)) {
    return Response.json({ error: "invalid_instance" }, { status: 400 });
  }

  const sessionId = randomUUID();
  
  // Store session server-side for verification during callback
  const ttlSecondsEnv = parseInt(process.env.MIAUTH_SESSION_TTL_SECONDS ?? "300", 10);
  const ttlSeconds = isFinite(ttlSecondsEnv) && ttlSecondsEnv > 0 ? ttlSecondsEnv : 300; // 5 min default
  createMiAuthSession(sessionId, instance, ttlSeconds);

  const callbackUrl = `${env.baseUrl}/auth/misskey/miauth-callback?instance=${encodeURIComponent(instance)}&session=${encodeURIComponent(sessionId)}`;

  const miAuthUrl = new URL(`https://${instance}/miauth/${sessionId}`);
  miAuthUrl.searchParams.set("name", "Moim");
  miAuthUrl.searchParams.set("callback", callbackUrl);
  miAuthUrl.searchParams.set("permission", "read:account"); // minimal — just who they are

  return Response.json({ redirectUrl: miAuthUrl.toString() });
};