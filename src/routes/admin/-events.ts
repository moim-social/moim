import { desc, eq, ilike, sql } from "drizzle-orm";
import { db } from "~/server/db/client";
import { events, users, actors, eventCategories } from "~/server/db/schema";
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
      id: events.id,
      title: events.title,
      startsAt: events.startsAt,
      published: events.published,
      priority: events.priority,
      deletedAt: events.deletedAt,
      createdAt: events.createdAt,
      organizerDisplayName: users.displayName,
      groupHandle: actors.handle,
      groupName: actors.name,
      categoryLabel: eventCategories.label,
    })
    .from(events)
    .innerJoin(users, eq(events.organizerId, users.id))
    .leftJoin(actors, eq(events.groupActorId, actors.id))
    .leftJoin(eventCategories, eq(events.categoryId, eventCategories.slug))
    .$dynamic();

  let countQuery = db
    .select({ total: sql<number>`count(*)::int` })
    .from(events)
    .$dynamic();

  if (query) {
    const escaped = query.replace(/[%_\\]/g, "\\$&");
    const searchCondition = ilike(events.title, `%${escaped}%`);
    baseQuery = baseQuery.where(searchCondition);
    countQuery = countQuery.where(searchCondition);
  }

  const [rows, [countRow]] = await Promise.all([
    baseQuery
      .orderBy(desc(events.priority), desc(events.createdAt))
      .limit(limit)
      .offset(offset),
    countQuery,
  ]);

  return Response.json({
    events: rows,
    total: countRow?.total ?? 0,
  });
};

export const PATCH = async ({ request }: { request: Request }) => {
  await requireAdmin(request);

  const body = (await request.json().catch(() => null)) as {
    id?: string;
    priority?: number;
  } | null;

  if (!body?.id || typeof body.priority !== "number") {
    return Response.json(
      { error: "id and priority are required" },
      { status: 400 },
    );
  }

  const [event] = await db
    .select({ id: events.id })
    .from(events)
    .where(eq(events.id, body.id))
    .limit(1);

  if (!event) {
    return Response.json({ error: "Event not found" }, { status: 404 });
  }

  await db
    .update(events)
    .set({ priority: body.priority })
    .where(eq(events.id, body.id));

  return Response.json({ ok: true });
};
