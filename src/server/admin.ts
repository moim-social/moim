import { getSessionUser, type SessionUser } from "~/server/auth";
import { env } from "~/server/env";

export function isAdmin(user: SessionUser | null): boolean {
  if (!user || !user.fediverseHandle) return false;
  return env.instanceAdminHandles.includes(user.fediverseHandle);
}

export async function requireAdmin(request: Request): Promise<SessionUser> {
  const user = await getSessionUser(request);
  if (!user || !isAdmin(user)) {
    throw new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }
  return user;
}
