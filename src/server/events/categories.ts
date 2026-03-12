import { asc, eq } from "drizzle-orm";
import { db } from "~/server/db/client";
import { eventCategories } from "~/server/db/schema";

export type EventCategoryRow = typeof eventCategories.$inferSelect;

export async function getEventCategories(includeDisabled = false): Promise<EventCategoryRow[]> {
  const rows = await db
    .select()
    .from(eventCategories)
    .orderBy(asc(eventCategories.sortOrder), asc(eventCategories.label));

  return includeDisabled ? rows : rows.filter((row) => row.enabled);
}

export async function getEventCategory(slug: string): Promise<EventCategoryRow | null> {
  const [row] = await db
    .select()
    .from(eventCategories)
    .where(eq(eventCategories.slug, slug))
    .limit(1);
  return row ?? null;
}

export async function assertEnabledEventCategory(slug: string): Promise<EventCategoryRow> {
  const [row] = await db
    .select()
    .from(eventCategories)
    .where(eq(eventCategories.slug, slug))
    .limit(1);

  if (!row) {
    throw new Error("Invalid event category slug");
  }
  if (!row.enabled) {
    throw new Error("Selected event category is disabled");
  }

  return row;
}
