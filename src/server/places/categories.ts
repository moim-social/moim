import { asc, eq, inArray } from "drizzle-orm";
import { db } from "~/server/db/client";
import { placeCategories } from "~/server/db/schema";

export type PlaceCategoryRow = typeof placeCategories.$inferSelect;

export type PlaceCategoryTreeNode = PlaceCategoryRow & {
  children: PlaceCategoryTreeNode[];
  depth: number;
};

export type PlaceCategoryOption = {
  id: string;
  label: string;
  emoji: string;
  depth: number;
  enabled: boolean;
};

export async function getPlaceCategories(includeDisabled = false): Promise<PlaceCategoryRow[]> {
  const rows = await db
    .select()
    .from(placeCategories)
    .orderBy(asc(placeCategories.sortOrder), asc(placeCategories.label));

  return includeDisabled ? rows : rows.filter((row) => row.enabled);
}

export function buildPlaceCategoryTree(rows: PlaceCategoryRow[]): PlaceCategoryTreeNode[] {
  const byId = new Map<string, PlaceCategoryTreeNode>();
  const roots: PlaceCategoryTreeNode[] = [];

  for (const row of rows) {
    byId.set(row.id, { ...row, children: [], depth: 0 });
  }

  for (const node of byId.values()) {
    if (node.parentId) {
      const parent = byId.get(node.parentId);
      if (parent) {
        node.depth = parent.depth + 1;
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

export function flattenPlaceCategoryTree(nodes: PlaceCategoryTreeNode[]): PlaceCategoryOption[] {
  return nodes.flatMap((node) => [
    {
      id: node.id,
      label: node.label,
      emoji: node.emoji,
      depth: node.depth,
      enabled: node.enabled,
    },
    ...flattenPlaceCategoryTree(node.children),
  ]);
}

export function getDescendantCategoryIds(categoryId: string, rows: PlaceCategoryRow[]): string[] {
  const childrenByParent = new Map<string | null, PlaceCategoryRow[]>();
  for (const row of rows) {
    const key = row.parentId ?? null;
    const existing = childrenByParent.get(key) ?? [];
    existing.push(row);
    childrenByParent.set(key, existing);
  }

  const result: string[] = [];
  const stack = [categoryId];

  while (stack.length > 0) {
    const current = stack.pop()!;
    result.push(current);
    for (const child of childrenByParent.get(current) ?? []) {
      stack.push(child.id);
    }
  }

  return result;
}

export function getCategoryPath(categoryId: string, rows: PlaceCategoryRow[]): PlaceCategoryRow[] {
  const byId = new Map(rows.map((row) => [row.id, row]));
  const path: PlaceCategoryRow[] = [];
  let current = byId.get(categoryId);

  while (current) {
    path.unshift(current);
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }

  return path;
}

export async function getPlaceCategorySummary(categoryId: string | null | undefined) {
  if (!categoryId) return null;
  const [row] = await db
    .select({
      id: placeCategories.id,
      slug: placeCategories.slug,
      label: placeCategories.label,
      emoji: placeCategories.emoji,
      enabled: placeCategories.enabled,
    })
    .from(placeCategories)
    .where(eq(placeCategories.id, categoryId))
    .limit(1);
  return row ?? null;
}

export async function getPlaceCategorySummaries(categoryIds: string[]) {
  if (categoryIds.length === 0) return [];
  return db
    .select({
      id: placeCategories.id,
      slug: placeCategories.slug,
      label: placeCategories.label,
      emoji: placeCategories.emoji,
      enabled: placeCategories.enabled,
    })
    .from(placeCategories)
    .where(inArray(placeCategories.id, categoryIds));
}

export async function assertEnabledPlaceCategory(categoryId: string): Promise<PlaceCategoryRow> {
  const [row] = await db
    .select()
    .from(placeCategories)
    .where(eq(placeCategories.id, categoryId))
    .limit(1);

  if (!row) {
    throw new Error("Invalid categoryId");
  }
  if (!row.enabled) {
    throw new Error("Selected category is disabled");
  }

  return row;
}

export function wouldCreatePlaceCategoryCycle(
  categoryId: string,
  nextParentId: string | null,
  rows: PlaceCategoryRow[],
): boolean {
  if (!nextParentId) return false;
  if (nextParentId === categoryId) return true;

  const byId = new Map(rows.map((row) => [row.id, row]));
  let current = byId.get(nextParentId);

  while (current) {
    if (current.id === categoryId) return true;
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }

  return false;
}
