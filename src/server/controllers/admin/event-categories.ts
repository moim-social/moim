import { eq } from "drizzle-orm";
import { db } from "~/server/db/client";
import { eventCategories, events } from "~/server/db/schema";
import { requireAdmin } from "~/server/admin";
import { getEventCategories } from "~/server/events/categories";
import { EVENT_CATEGORY_PRESET, flattenEventCategoryPreset } from "~/shared/categories";

const SNAKE_CASE_RE = /^[a-z][a-z0-9_]*$/;

function normalizeOptionalString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized ? normalized : null;
}

function toSnakeCase(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_{2,}/g, "_");
}

type ImportCategoryRecord = {
  slug: string;
  label: string;
  labels: Record<string, string>;
  emoji: string | null;
  description: string | null;
  sortOrder: number;
  enabled: boolean;
};

function validateImportCategories(input: unknown): ImportCategoryRecord[] {
  if (!Array.isArray(input)) {
    throw new Error("categories must be an array");
  }

  const rows = input.map((value, index) => {
    const record = value as Record<string, unknown> | null;
    const rawSlug = normalizeOptionalString(record?.slug);
    const label = normalizeOptionalString(record?.label);
    const emoji = normalizeOptionalString(record?.emoji);
    const description = normalizeOptionalString(record?.description);
    const sortOrder = Number(record?.sortOrder ?? 0);
    const enabled = record?.enabled !== false;
    const labels = record?.labels != null && typeof record.labels === "object" && !Array.isArray(record.labels)
      ? (record.labels as Record<string, string>)
      : {};

    if (!rawSlug || !label || Number.isNaN(sortOrder)) {
      throw new Error(`category at index ${index} is missing required fields (slug, label)`);
    }

    const slug = toSnakeCase(rawSlug);
    if (!SNAKE_CASE_RE.test(slug)) {
      throw new Error(`category at index ${index} has invalid slug "${rawSlug}" (must be snake_case: lowercase letters, digits, underscores)`);
    }

    return { slug, label, labels, emoji, description, sortOrder, enabled };
  });

  const slugSet = new Set<string>();
  for (const row of rows) {
    if (slugSet.has(row.slug)) {
      throw new Error(`duplicate category slug: ${row.slug}`);
    }
    slugSet.add(row.slug);
  }

  return rows;
}

function buildExportPayload(rows: Awaited<ReturnType<typeof getEventCategories>>) {
  return {
    exportedAt: new Date().toISOString(),
    categories: rows.map((row) => ({
      slug: row.slug,
      label: row.label,
      labels: row.labels,
      emoji: row.emoji,
      description: row.description,
      sortOrder: row.sortOrder,
      enabled: row.enabled,
    })),
    preset: flattenEventCategoryPreset(EVENT_CATEGORY_PRESET),
  };
}

export const GET = async ({ request }: { request: Request }) => {
  await requireAdmin(request);
  const url = new URL(request.url);
  const rows = await getEventCategories(true);

  if (url.searchParams.get("format") === "json") {
    return Response.json(buildExportPayload(rows));
  }

  return Response.json({ categories: rows });
};

export const POST = async ({ request }: { request: Request }) => {
  await requireAdmin(request);
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;

  const rawSlug = normalizeOptionalString(body?.slug);
  const label = normalizeOptionalString(body?.label);
  const emoji = normalizeOptionalString(body?.emoji);
  const description = normalizeOptionalString(body?.description);
  const sortOrder = Number(body?.sortOrder ?? 0);
  const enabled = body?.enabled !== false;
  const labels = body?.labels != null && typeof body.labels === "object" && !Array.isArray(body.labels)
    ? (body.labels as Record<string, string>)
    : {};

  if (!rawSlug || !label || Number.isNaN(sortOrder)) {
    return Response.json(
      { error: "slug, label, and a valid sortOrder are required" },
      { status: 400 },
    );
  }

  const slug = toSnakeCase(rawSlug);
  if (!SNAKE_CASE_RE.test(slug)) {
    return Response.json(
      { error: "slug must be snake_case (lowercase letters, digits, underscores, starting with a letter)" },
      { status: 400 },
    );
  }

  const rows = await getEventCategories(true);
  const existing = rows.find((row) => row.slug === slug);

  if (existing) {
    const [category] = await db
      .update(eventCategories)
      .set({
        label,
        labels,
        emoji,
        description,
        sortOrder,
        enabled,
        updatedAt: new Date(),
      })
      .where(eq(eventCategories.slug, slug))
      .returning();

    return Response.json({ category });
  }

  const [category] = await db
    .insert(eventCategories)
    .values({
      slug,
      label,
      labels,
      emoji,
      description,
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

  const rows = await getEventCategories(true);
  const current = rows.find((row) => row.slug === categorySlug);
  if (!current) {
    return Response.json({ error: "Category not found" }, { status: 404 });
  }

  const updates: Partial<typeof eventCategories.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (body && "label" in body) {
    const label = normalizeOptionalString(body.label);
    if (!label) return Response.json({ error: "label is required" }, { status: 400 });
    updates.label = label;
  }
  if (body && "emoji" in body) {
    updates.emoji = normalizeOptionalString(body.emoji);
  }
  if (body && "description" in body) {
    updates.description = normalizeOptionalString(body.description);
  }
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
    .update(eventCategories)
    .set(updates)
    .where(eq(eventCategories.slug, categorySlug))
    .returning();

  return Response.json({ category });
};

export const PUT = async ({ request }: { request: Request }) => {
  await requireAdmin(request);
  const body = await request.json().catch(() => null) as Record<string, unknown> | ImportCategoryRecord[] | null;

  try {
    const imported = validateImportCategories(
      Array.isArray(body) ? body : (body as Record<string, unknown> | null)?.categories,
    );
    const importedSlugs = new Set(imported.map((row) => row.slug));
    const existing = await getEventCategories(true);
    const removedSlugs = existing
      .map((row) => row.slug)
      .filter((slug) => !importedSlugs.has(slug));

    if (removedSlugs.length > 0) {
      const usedSlugs = new Set<string>();
      for (const slug of removedSlugs) {
        const [used] = await db
          .select({ categoryId: events.categoryId })
          .from(events)
          .where(eq(events.categoryId, slug))
          .limit(1);
        if (used?.categoryId) usedSlugs.add(used.categoryId);
      }

      if (usedSlugs.size > 0) {
        return Response.json(
          { error: `Cannot remove categories still used by events: ${[...usedSlugs].join(", ")}` },
          { status: 400 },
        );
      }
    }

    await db.transaction(async (tx) => {
      for (const row of imported) {
        const [existingRow] = await tx
          .select({ slug: eventCategories.slug })
          .from(eventCategories)
          .where(eq(eventCategories.slug, row.slug))
          .limit(1);

        if (existingRow) {
          await tx
            .update(eventCategories)
            .set({
              label: row.label,
              ...(Object.keys(row.labels).length > 0 ? { labels: row.labels } : {}),
              emoji: row.emoji,
              description: row.description,
              sortOrder: row.sortOrder,
              enabled: row.enabled,
              updatedAt: new Date(),
            })
            .where(eq(eventCategories.slug, row.slug));
        } else {
          await tx
            .insert(eventCategories)
            .values({
              slug: row.slug,
              label: row.label,
              labels: row.labels,
              emoji: row.emoji,
              description: row.description,
              sortOrder: row.sortOrder,
              enabled: row.enabled,
              updatedAt: new Date(),
            });
        }
      }

      for (const slug of removedSlugs) {
        await tx.delete(eventCategories).where(eq(eventCategories.slug, slug));
      }
    });

    const rows = await getEventCategories(true);
    return Response.json({ categories: rows });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to import categories";
    return Response.json({ error: message }, { status: 400 });
  }
};
