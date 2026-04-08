import { desc, eq, ilike, sql } from "drizzle-orm";
import { db } from "~/server/db/client";
import { events, users, actors, eventCategories } from "~/server/db/schema";
import { requireAdmin } from "~/server/admin";
import { getEventCategories } from "~/server/events/categories";

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
      categoryId: events.categoryId,
      categoryLabel: eventCategories.label,
      country: events.country,
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
    categoryId?: string;
  } | null;

  if (!body?.id) {
    return Response.json({ error: "id is required" }, { status: 400 });
  }

  if (body.priority === undefined && body.categoryId === undefined) {
    return Response.json(
      { error: "At least one of priority or categoryId is required" },
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

  const updates: Record<string, unknown> = {};

  if (body.priority !== undefined) {
    updates.priority = body.priority;
  }

  if (body.categoryId !== undefined) {
    const allCategories = await getEventCategories();
    const validCategoryIds = new Set(allCategories.map((c) => c.slug));
    if (!validCategoryIds.has(body.categoryId)) {
      return Response.json({ error: "Invalid categoryId" }, { status: 400 });
    }
    updates.categoryId = body.categoryId;
  }

  await db
    .update(events)
    .set(updates)
    .where(eq(events.id, body.id));

  return Response.json({ ok: true });
};
