import { and, eq } from "drizzle-orm";
import { db } from "~/server/db/client";
import { actors } from "~/server/db/schema";

export async function findGroupHandleById(id: string): Promise<string | null> {
  const [group] = await db
    .select({ handle: actors.handle })
    .from(actors)
    .where(and(eq(actors.id, id), eq(actors.type, "Group")))
    .limit(1);

  return group?.handle ?? null;
}

export async function findGroupByHandle(handle: string): Promise<
  { id: string; name: string | null; handle: string } | undefined
> {
  const [group] = await db
    .select({ id: actors.id, name: actors.name, handle: actors.handle })
    .from(actors)
    .where(and(eq(actors.handle, handle), eq(actors.type, "Group")))
    .limit(1);

  return group;
}
