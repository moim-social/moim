import { asc, eq, inArray } from "drizzle-orm";
import { db } from "~/server/db/client";
import { placeCategories } from "~/server/db/schema";
import { env } from "~/server/env";

export type PlaceCategoryRow = typeof placeCategories.$inferSelect;

export type PlaceCategoryTreeNode = PlaceCategoryRow & {
  children: PlaceCategoryTreeNode[];
  depth: number;
};

export type PlaceCategoryOption = {
  slug: string;
  label: string;
  emoji: string;
  depth: number;
  enabled: boolean;
};

export function resolveCategoryLabel(
  category: { label: string; labels: Record<string, string> },
  locale?: string | null,
): string {
  const requestedLocale = locale ?? env.defaultLocale;
  const exact = category.labels[requestedLocale];
  if (exact) return exact;
  const fallback = category.labels[env.defaultLocale];
  if (fallback) return fallback;
  return category.label;
}

export async function getPlaceCategories(includeDisabled = false): Promise<PlaceCategoryRow[]> {
  const rows = await db
    .select()
    .from(placeCategories)
    .orderBy(asc(placeCategories.sortOrder), asc(placeCategories.label));

  return includeDisabled ? rows : rows.filter((row) => row.enabled);
}

export function buildPlaceCategoryTree(rows: PlaceCategoryRow[]): PlaceCategoryTreeNode[] {
  const bySlug = new Map<string, PlaceCategoryTreeNode>();
  const roots: PlaceCategoryTreeNode[] = [];

  for (const row of rows) {
    bySlug.set(row.slug, { ...row, children: [], depth: 0 });
  }

  for (const node of bySlug.values()) {
    if (node.parentSlug) {
      const parent = bySlug.get(node.parentSlug);
      if (parent) {
        parent.children.push(node);
        continue;
      }
    }
    roots.push(node);
  }

  const sortNodes = (nodes: PlaceCategoryTreeNode[]) => {
    nodes.sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label));
    for (const node of nodes) sortNodes(node.children);
  };
  sortNodes(roots);

  const assignDepth = (nodes: PlaceCategoryTreeNode[], depth = 0) => {
    for (const node of nodes) {
      node.depth = depth;
      assignDepth(node.children, depth + 1);
    }
  };
  assignDepth(roots);

  return roots;
}

export function flattenPlaceCategoryTree(
  nodes: PlaceCategoryTreeNode[],
  locale?: string | null,
): PlaceCategoryOption[] {
  return nodes.flatMap((node) => [
    {
      slug: node.slug,
      label: resolveCategoryLabel(node, locale),
      emoji: node.emoji,
      depth: node.depth,
      enabled: node.enabled,
    },
    ...flattenPlaceCategoryTree(node.children, locale),
  ]);
}

export function getDescendantCategorySlugs(categorySlug: string, rows: PlaceCategoryRow[]): string[] {
  const childrenByParent = new Map<string | null, PlaceCategoryRow[]>();
  for (const row of rows) {
    const key = row.parentSlug ?? null;
    const existing = childrenByParent.get(key) ?? [];
    existing.push(row);
    childrenByParent.set(key, existing);
  }

  const result: string[] = [];
  const stack = [categorySlug];

  while (stack.length > 0) {
    const current = stack.pop()!;
    result.push(current);
    for (const child of childrenByParent.get(current) ?? []) {
      stack.push(child.slug);
    }
  }

  return result;
}

export const getDescendantCategoryIds = getDescendantCategorySlugs;

export function getCategoryPath(categorySlug: string, rows: PlaceCategoryRow[]): PlaceCategoryRow[] {
  const bySlug = new Map(rows.map((row) => [row.slug, row]));
  const path: PlaceCategoryRow[] = [];
  let current = bySlug.get(categorySlug);

  while (current) {
    path.unshift(current);
    current = current.parentSlug ? bySlug.get(current.parentSlug) : undefined;
  }

  return path;
}

export async function getPlaceCategorySummary(
  categorySlug: string | null | undefined,
  locale?: string | null,
) {
  if (!categorySlug) return null;
  const [row] = await db
    .select({
      slug: placeCategories.slug,
      label: placeCategories.label,
      labels: placeCategories.labels,
      emoji: placeCategories.emoji,
      enabled: placeCategories.enabled,
    })
    .from(placeCategories)
    .where(eq(placeCategories.slug, categorySlug))
    .limit(1);
  if (!row) return null;
  return {
    slug: row.slug,
    label: resolveCategoryLabel(row, locale),
    emoji: row.emoji,
    enabled: row.enabled,
  };
}

export async function getPlaceCategorySummaries(
  categorySlugs: string[],
  locale?: string | null,
) {
  if (categorySlugs.length === 0) return [];
  const rows = await db
    .select({
      slug: placeCategories.slug,
      label: placeCategories.label,
      labels: placeCategories.labels,
      emoji: placeCategories.emoji,
      enabled: placeCategories.enabled,
    })
    .from(placeCategories)
    .where(inArray(placeCategories.slug, categorySlugs));
  return rows.map((row) => ({
    slug: row.slug,
    label: resolveCategoryLabel(row, locale),
    emoji: row.emoji,
    enabled: row.enabled,
  }));
}

export async function assertEnabledPlaceCategory(categorySlug: string): Promise<PlaceCategoryRow> {
  const [row] = await db
    .select()
    .from(placeCategories)
    .where(eq(placeCategories.slug, categorySlug))
    .limit(1);

  if (!row) {
    throw new Error("Invalid category slug");
  }
  if (!row.enabled) {
    throw new Error("Selected category is disabled");
  }

  return row;
}

export function wouldCreatePlaceCategoryCycle(
  categorySlug: string,
  nextParentSlug: string | null,
  rows: PlaceCategoryRow[],
): boolean {
  if (!nextParentSlug) return false;
  if (nextParentSlug === categorySlug) return true;

  const bySlug = new Map(rows.map((row) => [row.slug, row]));
  let current = bySlug.get(nextParentSlug);

  while (current) {
    if (current.slug === categorySlug) return true;
    current = current.parentSlug ? bySlug.get(current.parentSlug) : undefined;
  }

  return false;
}
