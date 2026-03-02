import { eq } from "drizzle-orm";
import { db } from "~/server/db/client";
import { placeCategories } from "~/server/db/schema";
import { requireAdmin } from "~/server/admin";
import {
  buildPlaceCategoryTree,
  flattenPlaceCategoryTree,
  getPlaceCategories,
  wouldCreatePlaceCategoryCycle,
} from "~/server/places/categories";

function normalizeOptionalString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized ? normalized : null;
}

export const GET = async ({ request }: { request: Request }) => {
  await requireAdmin(request);
  const rows = await getPlaceCategories(true);
  const tree = buildPlaceCategoryTree(rows);

  return Response.json({
    categories: tree,
    options: flattenPlaceCategoryTree(tree),
  });
};

export const POST = async ({ request }: { request: Request }) => {
  await requireAdmin(request);
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;

  const id = normalizeOptionalString(body?.id);
  const slug = normalizeOptionalString(body?.slug);
  const label = normalizeOptionalString(body?.label);
  const emoji = normalizeOptionalString(body?.emoji);
  const parentId = normalizeOptionalString(body?.parentId);
  const sortOrder = Number(body?.sortOrder ?? 0);
  const enabled = body?.enabled !== false;

  if (!id || !slug || !label || !emoji || Number.isNaN(sortOrder)) {
    return Response.json(
      { error: "id, slug, label, emoji, and a valid sortOrder are required" },
      { status: 400 },
    );
  }

  const rows = await getPlaceCategories(true);
  if (rows.some((row) => row.id === id)) {
    return Response.json({ error: "Category id already exists" }, { status: 409 });
  }
  if (rows.some((row) => row.slug === slug)) {
    return Response.json({ error: "Category slug already exists" }, { status: 409 });
  }
  if (parentId && !rows.some((row) => row.id === parentId)) {
    return Response.json({ error: "Parent category not found" }, { status: 400 });
  }

  const [category] = await db
    .insert(placeCategories)
    .values({
      id,
      slug,
      label,
      emoji,
      parentId,
      sortOrder,
      enabled,
      updatedAt: new Date(),
    })
    .returning();

  return Response.json({ category }, { status: 201 });
};

export const PATCH = async ({ request }: { request: Request }) => {
  await requireAdmin(request);
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const categoryId = normalizeOptionalString(body?.id);

  if (!categoryId) {
    return Response.json({ error: "id is required" }, { status: 400 });
  }

  const rows = await getPlaceCategories(true);
  const current = rows.find((row) => row.id === categoryId);
  if (!current) {
    return Response.json({ error: "Category not found" }, { status: 404 });
  }

  const nextParentId = body && "parentId" in body
    ? normalizeOptionalString(body.parentId)
    : current.parentId;
  if (nextParentId && !rows.some((row) => row.id === nextParentId)) {
    return Response.json({ error: "Parent category not found" }, { status: 400 });
  }
  if (wouldCreatePlaceCategoryCycle(categoryId, nextParentId, rows)) {
    return Response.json({ error: "Category parent would create a cycle" }, { status: 400 });
  }

  const nextSlug = body && "slug" in body
    ? normalizeOptionalString(body.slug)
    : current.slug;
  if (!nextSlug) {
    return Response.json({ error: "slug is required" }, { status: 400 });
  }
  if (rows.some((row) => row.id !== categoryId && row.slug === nextSlug)) {
    return Response.json({ error: "Category slug already exists" }, { status: 409 });
  }

  const updates: Partial<typeof placeCategories.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (body && "slug" in body) updates.slug = nextSlug;
  if (body && "label" in body) {
    const label = normalizeOptionalString(body.label);
    if (!label) return Response.json({ error: "label is required" }, { status: 400 });
    updates.label = label;
  }
  if (body && "emoji" in body) {
    const emoji = normalizeOptionalString(body.emoji);
    if (!emoji) return Response.json({ error: "emoji is required" }, { status: 400 });
    updates.emoji = emoji;
  }
  if (body && "parentId" in body) updates.parentId = nextParentId;
  if (body && "sortOrder" in body) {
    const sortOrder = Number(body.sortOrder);
    if (Number.isNaN(sortOrder)) {
      return Response.json({ error: "sortOrder must be a number" }, { status: 400 });
    }
    updates.sortOrder = sortOrder;
  }
  if (body && "enabled" in body) updates.enabled = body.enabled === true;

  const [category] = await db
    .update(placeCategories)
    .set(updates)
    .where(eq(placeCategories.id, categoryId))
    .returning();

  return Response.json({ category });
};
