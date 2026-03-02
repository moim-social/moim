import { and, desc, eq, ilike, inArray, sql, type SQL } from "drizzle-orm";
import { db } from "~/server/db/client";
import { checkins, placeCategories, places } from "~/server/db/schema";
import { requireAdmin } from "~/server/admin";
import { getDescendantCategoryIds, getPlaceCategories } from "~/server/places/categories";

function normalizeOptionalString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized ? normalized : null;
}

export const GET = async ({ request }: { request: Request }) => {
  await requireAdmin(request);
  const url = new URL(request.url);
  const query = normalizeOptionalString(url.searchParams.get("q"));
  const categoryId = normalizeOptionalString(url.searchParams.get("categoryId"));
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "50", 10), 100);
  const offset = parseInt(url.searchParams.get("offset") ?? "0", 10);

  const conditions: SQL[] = [];
  if (query) {
    const escaped = query.replace(/[%_\\]/g, "\\$&");
    conditions.push(ilike(places.name, `%${escaped}%`));
  }
  if (categoryId) {
    const categoryRows = await getPlaceCategories(true);
    conditions.push(inArray(places.categoryId, getDescendantCategoryIds(categoryId, categoryRows)));
  }

  let baseQuery = db
    .select({
      id: places.id,
      name: places.name,
      description: places.description,
      address: places.address,
      website: places.website,
      createdAt: places.createdAt,
      categoryId: places.categoryId,
      categoryLabel: placeCategories.label,
      categoryEmoji: placeCategories.emoji,
      categorySlug: placeCategories.slug,
      checkinCount: sql<number>`coalesce(count(${checkins.id})::int, 0)`,
    })
    .from(places)
    .leftJoin(placeCategories, eq(places.categoryId, placeCategories.id))
    .leftJoin(checkins, eq(checkins.placeId, places.id))
    .groupBy(
      places.id,
      placeCategories.id,
      placeCategories.label,
      placeCategories.emoji,
      placeCategories.slug,
    )
    .$dynamic();

  let countQuery = db
    .select({ total: sql<number>`count(*)::int` })
    .from(places)
    .$dynamic();

  if (conditions.length > 0) {
    baseQuery = baseQuery.where(and(...conditions));
    countQuery = countQuery.where(and(...conditions));
  }

  const [rows, [countRow]] = await Promise.all([
    baseQuery.orderBy(desc(places.createdAt)).limit(limit).offset(offset),
    countQuery,
  ]);

  return Response.json({
    places: rows.map((row) => ({
      ...row,
      category: row.categoryId
        ? {
            id: row.categoryId,
            slug: row.categorySlug,
            label: row.categoryLabel,
            emoji: row.categoryEmoji,
          }
        : null,
    })),
    total: countRow?.total ?? 0,
  });
};

export const PATCH = async ({ request }: { request: Request }) => {
  await requireAdmin(request);
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const placeId = normalizeOptionalString(body?.id);

  if (!placeId) {
    return Response.json({ error: "id is required" }, { status: 400 });
  }

  const [existingPlace] = await db
    .select({ id: places.id })
    .from(places)
    .where(eq(places.id, placeId))
    .limit(1);
  if (!existingPlace) {
    return Response.json({ error: "Place not found" }, { status: 404 });
  }

  const updates: Partial<typeof places.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (body && "categoryId" in body) {
    const categoryId = normalizeOptionalString(body.categoryId);
    if (categoryId) {
      const rows = await getPlaceCategories(true);
      if (!rows.some((row) => row.id === categoryId)) {
        return Response.json({ error: "Category not found" }, { status: 400 });
      }
      updates.categoryId = categoryId;
    } else {
      updates.categoryId = null;
    }
  }
  if (body && "description" in body) updates.description = normalizeOptionalString(body.description);
  if (body && "address" in body) updates.address = normalizeOptionalString(body.address);
  if (body && "website" in body) updates.website = normalizeOptionalString(body.website);

  const [place] = await db
    .update(places)
    .set(updates)
    .where(eq(places.id, placeId))
    .returning();

  return Response.json({ place });
};
