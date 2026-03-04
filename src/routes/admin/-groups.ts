import { eq, desc, ilike, or, sql } from "drizzle-orm";
import { db } from "~/server/db/client";
import { actors } from "~/server/db/schema";
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
      id: actors.id,
      handle: actors.handle,
      name: actors.name,
      avatarUrl: actors.avatarUrl,
      verified: actors.verified,
      followersCount: actors.followersCount,
      createdAt: actors.createdAt,
    })
    .from(actors)
    .where(eq(actors.type, "Group"))
    .$dynamic();

  let countQuery = db
    .select({ total: sql<number>`count(*)::int` })
    .from(actors)
    .where(eq(actors.type, "Group"))
    .$dynamic();

  if (query) {
    const escaped = query.replace(/[%_\\]/g, "\\$&");
    const searchCondition = or(
      ilike(actors.handle, `%${escaped}%`),
      ilike(actors.name, `%${escaped}%`),
    );
    baseQuery = baseQuery.where(searchCondition!);
    countQuery = countQuery.where(searchCondition!);
  }

  const [rows, [countRow]] = await Promise.all([
    baseQuery.orderBy(desc(actors.createdAt)).limit(limit).offset(offset),
    countQuery,
  ]);

  return Response.json({
    groups: rows,
    total: countRow?.total ?? 0,
  });
};

export const PATCH = async ({ request }: { request: Request }) => {
  await requireAdmin(request);

  const body = (await request.json().catch(() => null)) as {
    id?: string;
    verified?: boolean;
  } | null;

  if (!body?.id || body.verified === undefined) {
    return Response.json(
      { error: "id and verified are required" },
      { status: 400 },
    );
  }

  const [group] = await db
    .select({ id: actors.id })
    .from(actors)
    .where(eq(actors.id, body.id))
    .limit(1);

  if (!group) {
    return Response.json({ error: "Group not found" }, { status: 404 });
  }

  await db
    .update(actors)
    .set({ verified: body.verified, updatedAt: new Date() })
    .where(eq(actors.id, body.id));

  return Response.json({ ok: true });
};
