import { eq, and, gt } from "drizzle-orm";
import { db } from "~/server/db/client";
import { sessions, users } from "~/server/db/schema";

export function parseCookie(
  cookieHeader: string | null,
  name: string,
): string | null {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match ? match[1] : null;
}

export type SessionUser = {
  id: string;
  handle: string;
  displayName: string;
};

export async function getSessionUser(
  request: Request,
): Promise<SessionUser | null> {
  const token = parseCookie(request.headers.get("cookie"), "session_token");
  if (!token) return null;

  const [row] = await db
    .select({
      id: users.id,
      handle: users.handle,
      displayName: users.displayName,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.token, token), gt(sessions.expiresAt, new Date())))
    .limit(1);

  return row ?? null;
}
