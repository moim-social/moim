import { eq } from "drizzle-orm";
import { db } from "~/server/db/client";
import { placeCategories, places } from "~/server/db/schema";
import { requireAdmin } from "~/server/admin";
import {
  buildPlaceCategoryTree,
  flattenPlaceCategoryTree,
  getPlaceCategories,
  getCategoryPath,
  wouldCreatePlaceCategoryCycle,
} from "~/server/places/categories";
import { PLACE_CATEGORY_PRESET, flattenPlaceCategoryPreset } from "~/shared/place-categories";

function normalizeOptionalString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized ? normalized : null;
}

type ImportCategoryRecord = {
  slug: string;
  label: string;
  labels: Record<string, string>;
  emoji: string;
  parentSlug: string | null;
  sortOrder: number;
  enabled: boolean;
};

function validateImportCategories(input: unknown): ImportCategoryRecord[] {
  if (!Array.isArray(input)) {
    throw new Error("categories must be an array");
  }

  const rows = input.map((value, index) => {
    const record = value as Record<string, unknown> | null;
    const slug = normalizeOptionalString(record?.slug);
    const label = normalizeOptionalString(record?.label);
    const emoji = normalizeOptionalString(record?.emoji);
    const parentSlug = normalizeOptionalString(record?.parentSlug);
    const sortOrder = Number(record?.sortOrder ?? 0);
    const enabled = record?.enabled !== false;
    const labels = record?.labels != null && typeof record.labels === "object" && !Array.isArray(record.labels)
      ? (record.labels as Record<string, string>)
      : {};

    if (!slug || !label || !emoji || Number.isNaN(sortOrder)) {
      throw new Error(`category at index ${index} is missing required fields`);
    }

    return {
      slug,
      label,
      labels,
      emoji,
      parentSlug,
      sortOrder,
      enabled,
    };
  });

  const slugSet = new Set<string>();
  for (const row of rows) {
    if (slugSet.has(row.slug)) {
      throw new Error(`duplicate category slug: ${row.slug}`);
    }
    slugSet.add(row.slug);
  }

  for (const row of rows) {
    if (row.parentSlug && !slugSet.has(row.parentSlug)) {
      throw new Error(`parent category not found for ${row.slug}`);
    }
  }

  const rowMap = new Map(rows.map((row) => [row.slug, row]));
  for (const row of rows) {
    let current = row.parentSlug ? rowMap.get(row.parentSlug) : undefined;
    while (current) {
      if (current.slug === row.slug) {
        throw new Error(`category cycle detected at ${row.slug}`);
      }
      current = current.parentSlug ? rowMap.get(current.parentSlug) : undefined;
    }
  }

  return rows;
}

function orderImportCategories(rows: ImportCategoryRecord[]): ImportCategoryRecord[] {
  const childrenByParent = new Map<string | null, ImportCategoryRecord[]>();
  for (const row of rows) {
    const key = row.parentSlug ?? null;
    const group = childrenByParent.get(key) ?? [];
    group.push(row);
    childrenByParent.set(key, group);
  }

  const ordered: ImportCategoryRecord[] = [];
  const visit = (parentSlug: string | null) => {
    const children = childrenByParent.get(parentSlug) ?? [];
    children
      .sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label))
      .forEach((child) => {
        ordered.push(child);
        visit(child.slug);
      });
  };

  visit(null);
  return ordered;
}

function buildExportPayload(rows: Awaited<ReturnType<typeof getPlaceCategories>>) {
  return {
    exportedAt: new Date().toISOString(),
    categories: rows.map((row) => ({
      slug: row.slug,
      label: row.label,
      labels: row.labels,
      emoji: row.emoji,
      parentSlug: row.parentSlug,
      sortOrder: row.sortOrder,
      enabled: row.enabled,
    })),
    preset: flattenPlaceCategoryPreset(PLACE_CATEGORY_PRESET),
  };
}

export const GET = async ({ request }: { request: Request }) => {
  await requireAdmin(request);
  const url = new URL(request.url);
  const rows = await getPlaceCategories(true);
  const tree = buildPlaceCategoryTree(rows);

  if (url.searchParams.get("format") === "json") {
    return Response.json(buildExportPayload(rows));
  }

  return Response.json({
    categories: tree,
    options: flattenPlaceCategoryTree(tree),
  });
};

export const POST = async ({ request }: { request: Request }) => {
  await requireAdmin(request);
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;

  const slug = normalizeOptionalString(body?.slug);
  const label = normalizeOptionalString(body?.label);
  const emoji = normalizeOptionalString(body?.emoji);
  const parentSlug = normalizeOptionalString(body?.parentSlug);
  const sortOrder = Number(body?.sortOrder ?? 0);
  const enabled = body?.enabled !== false;
  const labels = body?.labels != null && typeof body.labels === "object" && !Array.isArray(body.labels)
    ? (body.labels as Record<string, string>)
    : {};

  if (!slug || !label || !emoji || Number.isNaN(sortOrder)) {
    return Response.json(
      { error: "slug, label, emoji, and a valid sortOrder are required" },
      { status: 400 },
    );
  }

  const rows = await getPlaceCategories(true);
  if (parentSlug && !rows.some((row) => row.slug === parentSlug)) {
    return Response.json({ error: "Parent category not found" }, { status: 400 });
  }

  const existing = rows.find((row) => row.slug === slug);
  if (existing && wouldCreatePlaceCategoryCycle(slug, parentSlug, rows)) {
    return Response.json({ error: "Category parent would create a cycle" }, { status: 400 });
  }

  if (existing) {
    const [category] = await db
      .update(placeCategories)
      .set({
        label,
        labels,
        emoji,
        parentSlug,
        sortOrder,
        enabled,
        updatedAt: new Date(),
      })
      .where(eq(placeCategories.slug, slug))
      .returning();

    return Response.json({ category });
  }

  const [category] = await db
    .insert(placeCategories)
    .values({
      slug,
      label,
      labels,
      emoji,
      parentSlug,
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
  const categorySlug = normalizeOptionalString(body?.categorySlug);

  if (!categorySlug) {
    return Response.json({ error: "categorySlug is required" }, { status: 400 });
  }

  const rows = await getPlaceCategories(true);
  const current = rows.find((row) => row.slug === categorySlug);
  if (!current) {
    return Response.json({ error: "Category not found" }, { status: 404 });
  }

  const nextParentSlug = body && "parentSlug" in body
    ? normalizeOptionalString(body.parentSlug)
    : current.parentSlug;
  if (nextParentSlug && !rows.some((row) => row.slug === nextParentSlug)) {
    return Response.json({ error: "Parent category not found" }, { status: 400 });
  }
  if (wouldCreatePlaceCategoryCycle(categorySlug, nextParentSlug, rows)) {
    return Response.json({ error: "Category parent would create a cycle" }, { status: 400 });
  }

  const updates: Partial<typeof placeCategories.$inferInsert> = {
    updatedAt: new Date(),
  };

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
  if (body && "parentSlug" in body) updates.parentSlug = nextParentSlug;
  if (body && "sortOrder" in body) {
    const sortOrder = Number(body.sortOrder);
    if (Number.isNaN(sortOrder)) {
      return Response.json({ error: "sortOrder must be a number" }, { status: 400 });
    }
    updates.sortOrder = sortOrder;
  }
  if (body && "enabled" in body) updates.enabled = body.enabled === true;
  if (body && "labels" in body) {
    updates.labels = body.labels != null && typeof body.labels === "object" && !Array.isArray(body.labels)
      ? (body.labels as Record<string, string>)
      : {};
  }

  const [category] = await db
    .update(placeCategories)
    .set(updates)
    .where(eq(placeCategories.slug, categorySlug))
    .returning();

  return Response.json({ category });
};

export const PUT = async ({ request }: { request: Request }) => {
  await requireAdmin(request);
  const body = await request.json().catch(() => null) as Record<string, unknown> | ImportCategoryRecord[] | null;

  try {
    const imported = orderImportCategories(
      validateImportCategories(Array.isArray(body) ? body : body?.categories),
    );
    const importedSlugs = new Set(imported.map((row) => row.slug));
    const existing = await getPlaceCategories(true);
    const removedSlugs = existing
      .map((row) => row.slug)
      .filter((slug) => !importedSlugs.has(slug));

    if (removedSlugs.length > 0) {
      const usedSlugs = new Set<string>();
      for (const slug of removedSlugs) {
        const [used] = await db
          .select({ categoryId: places.categoryId })
          .from(places)
          .where(eq(places.categoryId, slug))
          .limit(1);
        if (used?.categoryId) usedSlugs.add(used.categoryId);
      }

      if (usedSlugs.size > 0) {
        return Response.json(
          { error: `Cannot remove categories still used by places: ${[...usedSlugs].join(", ")}` },
          { status: 400 },
        );
      }
    }

    await db.transaction(async (tx) => {
      for (const row of imported) {
        const [existingRow] = await tx
          .select({ slug: placeCategories.slug })
          .from(placeCategories)
          .where(eq(placeCategories.slug, row.slug))
          .limit(1);

        if (existingRow) {
          await tx
            .update(placeCategories)
            .set({
              label: row.label,
              ...(row.labels != null ? { labels: row.labels } : {}),
              emoji: row.emoji,
              parentSlug: row.parentSlug,
              sortOrder: row.sortOrder,
              enabled: row.enabled,
              updatedAt: new Date(),
            })
            .where(eq(placeCategories.slug, row.slug));
        } else {
          await tx
            .insert(placeCategories)
            .values({
              slug: row.slug,
              label: row.label,
              labels: row.labels,
              emoji: row.emoji,
              parentSlug: row.parentSlug,
              sortOrder: row.sortOrder,
              enabled: row.enabled,
              updatedAt: new Date(),
            });
        }
      }

      const rows = await getPlaceCategories(true);
      const removedOrdered = rows
        .filter((row) => removedSlugs.includes(row.slug))
        .sort((a, b) => getCategoryPath(b.slug, rows).length - getCategoryPath(a.slug, rows).length);

      for (const row of removedOrdered) {
        await tx.delete(placeCategories).where(eq(placeCategories.slug, row.slug));
      }
    });

    const rows = await getPlaceCategories(true);
    const tree = buildPlaceCategoryTree(rows);

    return Response.json({
      categories: tree,
      options: flattenPlaceCategoryTree(tree),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to import categories";
    return Response.json({ error: message }, { status: 400 });
  }
};
