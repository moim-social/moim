import { db } from "~/server/db/client";
import { otpChallenges } from "~/server/db/schema";
import { env } from "~/server/env";

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

  const otp = generateOtp();
  const expiresAt = new Date(Date.now() + env.otpTtlSeconds * 1000);

  await db.insert(otpChallenges).values({
    handle: body.handle,
    otp,
    status: "pending",
    expiresAt,
  });

  return Response.json({
    handle: body.handle,
    expiresAt: expiresAt.toISOString(),
    instruction:
      "Post the OTP on your Fediverse account, then call /auth/verify-otp.",
    debugOtp: process.env.NODE_ENV === "development" ? otp : undefined,
  });
};
