import { randomUUID } from "crypto";
import { env } from "~/server/env";

export const POST = async ({ request }: { request: Request }) => {
  const body = await request.json().catch(() => null) as { instance?: string } | null;

  if (!body?.instance) {
    return Response.json({ error: "instance is required" }, { status: 400 });
  }

  const instance = body.instance.replace(/^https?:\/\//, "").replace(/\/$/, "");
  const sessionId = randomUUID();
  const callbackUrl = `${env.baseUrl}/auth/misskey/miauth-callback?instance=${encodeURIComponent(instance)}&session=${encodeURIComponent(sessionId)}`;

  const miAuthUrl = new URL(`https://${instance}/miauth/${sessionId}`);
  miAuthUrl.searchParams.set("name", "Moim");
  miAuthUrl.searchParams.set("callback", callbackUrl);
  miAuthUrl.searchParams.set("permission", "read:account"); // minimal — just who they are

  return Response.json({ redirectUrl: miAuthUrl.toString() });
};