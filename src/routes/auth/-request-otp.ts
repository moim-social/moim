import { db } from "~/server/db/client";
import { otpChallenges } from "~/server/db/schema";
import { env } from "~/server/env";
import { persistRemoteActor } from "~/server/fediverse/resolve";

function generateOtp(): string {
  const value = Math.floor(100000 + Math.random() * 900000);
  return String(value);
}

export const POST = async ({ request }: { request: Request }) => {
  const body = (await request.json().catch(() => null)) as {
    handle?: string;
  } | null;

  if (!body?.handle) {
    return Response.json({ error: "handle is required" }, { status: 400 });
  }

  const handle = body.handle.startsWith("@") ? body.handle.slice(1) : body.handle;

  // Resolve and persist the remote actor before generating OTP
  let actor;
  try {
    actor = await persistRemoteActor(handle);
  } catch (err) {
    return Response.json(
      { error: `Could not resolve actor: ${(err as Error).message}` },
      { status: 422 },
    );
  }

  const otp = generateOtp();
  const expiresAt = new Date(Date.now() + env.otpTtlSeconds * 1000);

  await db.insert(otpChallenges).values({
    handle,
    otp,
    status: "pending",
    expiresAt,
  });

  return Response.json({
    handle,
    otp,
    expiresAt: expiresAt.toISOString(),
    actorName: actor.name,
    instruction:
      "Post this OTP on your Fediverse account, then click Verify.",
  });
};
