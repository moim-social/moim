import { eq, gte } from "drizzle-orm";
import { db } from "~/server/db/client";
import { events, actors } from "~/server/db/schema";

export const GET = async ({ request }: { request: Request }) => {
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
    })
    .from(events)
    .leftJoin(actors, eq(events.groupActorId, actors.id))
    .where(gte(events.startsAt, new Date()))
    .orderBy(events.startsAt);

  return Response.json({ events: rows });
};
