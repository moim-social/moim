import { and, eq, ilike, or, sql } from "drizzle-orm";
import { db } from "~/server/db/client";
import { users, userFediverseAccounts } from "~/server/db/schema";
import { getSessionUser } from "~/server/auth";

export const GET = async ({ request }: { request: Request }) => {
  const user = await getSessionUser(request);
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const q = url.searchParams.get("q")?.trim();
  if (!q || q.length < 2) {
    return Response.json({ users: [] });
  }

  const pattern = `%${q}%`;
  // Search across all linked handles (not just primary)
  const userIdsWithMatchingHandle = db
    .select({ userId: userFediverseAccounts.userId })
    .from(userFediverseAccounts)
    .where(ilike(userFediverseAccounts.fediverseHandle, pattern));

  const results = await db
    .select({
      handle: userFediverseAccounts.fediverseHandle,
      displayName: users.displayName,
    })
    .from(users)
    .leftJoin(userFediverseAccounts, and(
      eq(userFediverseAccounts.userId, users.id),
      eq(userFediverseAccounts.isPrimary, true),
    ))
    .where(
      or(
        sql`${users.id} IN (${userIdsWithMatchingHandle})`,
        ilike(users.displayName, pattern),
      ),
    )
    .limit(10);

  return Response.json({ users: results });
};
