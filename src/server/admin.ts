import { eq } from "drizzle-orm";
import { getSessionUser, type SessionUser } from "~/server/auth";
import { db } from "~/server/db/client";
import { userFediverseAccounts } from "~/server/db/schema";
import { env } from "~/server/env";

export function isAdmin(user: SessionUser | null): boolean {
  if (!user || !user.fediverseHandle) return false;
  return env.instanceAdminHandles.includes(user.fediverseHandle);
}

export async function isAdminByUserId(userId: string): Promise<boolean> {
  const accounts = await db
    .select({ fediverseHandle: userFediverseAccounts.fediverseHandle })
    .from(userFediverseAccounts)
    .where(eq(userFediverseAccounts.userId, userId));
  return accounts.some((a) => env.instanceAdminHandles.includes(a.fediverseHandle));
}

export async function requireAdmin(request: Request): Promise<SessionUser> {
  const user = await getSessionUser(request);
  if (!user) {
    throw new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }
  // Quick check on primary handle, then fall back to checking all linked accounts
  if (!isAdmin(user) && !(await isAdminByUserId(user.id))) {
    throw new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }
  return user;
}
