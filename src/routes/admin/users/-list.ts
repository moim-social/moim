import { desc, ilike, or, sql } from "drizzle-orm";
import { db } from "~/server/db/client";
import { users } from "~/server/db/schema";
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
      fediverseHandle: users.fediverseHandle,
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
    })
    .from(users)
    .$dynamic();

  let countQuery = db
    .select({ total: sql<number>`count(*)::int` })
    .from(users)
    .$dynamic();

  if (query) {
    const escaped = query.replace(/[%_\\]/g, "\\$&");
    const searchCondition = or(
      ilike(users.handle, `%${escaped}%`),
      ilike(users.displayName, `%${escaped}%`),
      ilike(users.fediverseHandle, `%${escaped}%`),
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
