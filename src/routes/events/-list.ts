import { aliasedTable, and, eq, gte } from "drizzle-orm";
import { db } from "~/server/db/client";
import { events, actors, users } from "~/server/db/schema";

export const GET = async ({ request }: { request: Request }) => {
  const organizerActors = aliasedTable(actors, "organizer_actors");
  const rows = await db
    .select({
      id: events.id,
      title: events.title,
      description: events.description,
      categoryId: events.categoryId,
      startsAt: events.startsAt,
      endsAt: events.endsAt,
      location: events.location,
      createdAt: events.createdAt,
      groupHandle: actors.handle,
      groupName: actors.name,
      organizerHandle: users.fediverseHandle,
      organizerDisplayName: users.displayName,
      organizerActorUrl: organizerActors.url,
    })
    .from(events)
    .leftJoin(actors, eq(events.groupActorId, actors.id))
    .innerJoin(users, eq(events.organizerId, users.id))
    .leftJoin(organizerActors, and(
      eq(organizerActors.userId, users.id),
      eq(organizerActors.isLocal, false),
    ))
    .where(gte(events.startsAt, new Date()))
    .orderBy(events.startsAt);

  return Response.json({ events: rows });
};
