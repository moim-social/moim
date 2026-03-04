import { db } from "~/server/db/client";
import { placeAuditLog } from "~/server/db/schema";
import { env } from "~/server/env";

export async function logPlaceAction(entry: {
  placeId: string;
  groupActorId?: string | null;
  userId: string;
  action: string;
  changes?: Record<string, { old: unknown; new: unknown }> | null;
}): Promise<void> {
  if (!env.enablePlaceAuditLog) return;

  await db.insert(placeAuditLog).values({
    placeId: entry.placeId,
    groupActorId: entry.groupActorId ?? null,
    userId: entry.userId,
    action: entry.action,
    changes: entry.changes ?? null,
  });
}
