import { eq } from "drizzle-orm";
import { db } from "~/server/db/client";
import { sessions } from "~/server/db/schema";
import { parseCookie } from "~/server/auth";

export const POST = async ({ request }: { request: Request }) => {
  const token = parseCookie(request.headers.get("cookie"), "session_token");
  if (token) {
    await db.delete(sessions).where(eq(sessions.token, token));
  }

  const headers = new Headers();
  headers.set(
    "Set-Cookie",
    "session_token=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax",
  );

  return new Response(JSON.stringify({ ok: true }), { headers, status: 200 });
};
