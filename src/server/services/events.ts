import { eq, and } from "drizzle-orm";
import { db } from "~/server/db/client";
import {
  events,
  users,
  actors,
  userFediverseAccounts,
} from "~/server/db/schema";

export interface EventMeta {
  title: string;
  description: string | null;
  startsAt: Date;
  location: string | null;
  headerImageUrl: string | null;
  organizerHandle: string | null;
  groupHandle: string | null;
  groupName: string | null;
  groupDomain: string | null;
}

export async function getEventMeta(eventId: string): Promise<EventMeta | null> {
  const [row] = await db
    .select({
      title: events.title,
      description: events.description,
      startsAt: events.startsAt,
      location: events.location,
      headerImageUrl: events.headerImageUrl,
      organizerHandle: userFediverseAccounts.fediverseHandle,
      groupHandle: actors.handle,
      groupName: actors.name,
      groupDomain: actors.domain,
    })
    .from(events)
    .innerJoin(users, eq(events.organizerId, users.id))
    .leftJoin(
      userFediverseAccounts,
      and(
        eq(userFediverseAccounts.userId, users.id),
        eq(userFediverseAccounts.isPrimary, true),
      ),
    )
    .leftJoin(actors, eq(events.groupActorId, actors.id))
    .where(eq(events.id, eventId))
    .limit(1);

  return row ?? null;
}
