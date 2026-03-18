import { eq, inArray } from "drizzle-orm";
import { db } from "~/server/db/client";
import { actors, eventOrganizers } from "~/server/db/schema";
import type { IcsEventOrganizer } from "~/server/events/ics";

/**
 * Given a list of event rows (without organizers), batch-fetch organizers from
 * the eventOrganizers table and attach them to each event.
 */
export async function attachOrganizers<
  T extends { id: string },
>(rows: T[]): Promise<(T & { organizers: IcsEventOrganizer[] })[]> {
  if (rows.length === 0) return [];

  const eventIds = rows.map((r) => r.id);

  const orgRows = await db
    .select({
      eventId: eventOrganizers.eventId,
      actorName: actors.name,
      externalName: eventOrganizers.name,
    })
    .from(eventOrganizers)
    .leftJoin(actors, eq(eventOrganizers.actorId, actors.id))
    .where(inArray(eventOrganizers.eventId, eventIds));

  const orgMap = new Map<string, IcsEventOrganizer[]>();
  for (const row of orgRows) {
    const name = row.externalName ?? row.actorName;
    if (!name) continue;
    const list = orgMap.get(row.eventId) ?? [];
    list.push({ name });
    orgMap.set(row.eventId, list);
  }

  return rows.map((r) => ({
    ...r,
    organizers: orgMap.get(r.id) ?? [],
  }));
}
