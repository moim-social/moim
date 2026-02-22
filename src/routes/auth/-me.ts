import { eq, and, gt } from "drizzle-orm";
import { db } from "~/server/db/client";
import { sessions, users } from "~/server/db/schema";

function parseCookie(cookieHeader: string | null, name: string): string | null {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match ? match[1] : null;
}

export const GET = async ({ request }: { request: Request }) => {
  const token = parseCookie(request.headers.get("cookie"), "session_token");
  if (!token) {
    return Response.json({ user: null });
  }

  const [row] = await db
    .select({ handle: users.handle, displayName: users.displayName })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.token, token), gt(sessions.expiresAt, new Date())))
    .limit(1);

  return Response.json({ user: row ?? null });
};
