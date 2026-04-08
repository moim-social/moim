import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { db } from "~/server/db/client";
import { users, userFediverseAccounts } from "~/server/db/schema";
import { requireAdmin } from "~/server/admin";

export const GET = async ({ request }: { request: Request }) => {
  await requireAdmin(request);
  const url = new URL(request.url);
  const query = url.searchParams.get("q");
  const limit = Math.min(
    parseInt(url.searchParams.get("limit") ?? "50", 10),
    100,
  );
  const offset = parseInt(url.searchParams.get("offset") ?? "0", 10);

  let baseQuery = db
    .select({
      id: users.id,
      handle: users.handle,
      fediverseHandle: userFediverseAccounts.fediverseHandle,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
      createdAt: users.createdAt,
      groupCount: sql<number>`coalesce((
        SELECT count(*)::int FROM actors a
        INNER JOIN group_members gm ON gm.member_actor_id = a.id
        WHERE a.user_id = "users"."id"
      ), 0)`,
      eventCount: sql<number>`coalesce((
        SELECT count(*)::int FROM events e
        WHERE e.organizer_id = "users"."id"
      ), 0)`,
      checkinCount: sql<number>`coalesce((
        SELECT count(*)::int FROM checkins c
        WHERE c.user_id = "users"."id"
      ), 0)`,
      language: sql<string | null>`(
        SELECT a.language FROM actors a
        WHERE a.user_id = "users"."id" AND a.type = 'Person' AND a.is_local = true
        LIMIT 1
      )`,
    })
    .from(users)
    .leftJoin(userFediverseAccounts, and(
      eq(userFediverseAccounts.userId, users.id),
      eq(userFediverseAccounts.isPrimary, true),
    ))
    .$dynamic();

  let countQuery = db
    .select({ total: sql<number>`count(*)::int` })
    .from(users)
    .$dynamic();

  if (query) {
    const escaped = query.replace(/[%_\\]/g, "\\$&");
    // Search across all linked handles (not just primary)
    const userIdsWithMatchingHandle = db
      .select({ userId: userFediverseAccounts.userId })
      .from(userFediverseAccounts)
      .where(ilike(userFediverseAccounts.fediverseHandle, `%${escaped}%`));

    const searchCondition = or(
      ilike(users.handle, `%${escaped}%`),
      ilike(users.displayName, `%${escaped}%`),
      sql`${users.id} IN (${userIdsWithMatchingHandle})`,
    );
    baseQuery = baseQuery.where(searchCondition!);
    countQuery = countQuery.where(searchCondition!);
  }

  const [rows, [countRow]] = await Promise.all([
    baseQuery.orderBy(desc(users.createdAt)).limit(limit).offset(offset),
    countQuery,
  ]);

  return Response.json({
    users: rows,
    total: countRow?.total ?? 0,
  });
};
