import { and, eq, isNotNull } from "drizzle-orm";
import { db } from "~/server/db/client";
import { actors, events, users } from "~/server/db/schema";

export const GET = async ({ request }: { request: Request }) => {
  const url = new URL(request.url);
  const placeId = url.searchParams.get("placeId");

  if (!placeId) {
    return Response.json({ error: "placeId is required" }, { status: 400 });
  }

  const placeEvents = await db
    .select({
      id: events.id,
      title: events.title,
      categoryId: events.categoryId,
      startsAt: events.startsAt,
      endsAt: events.endsAt,
      timezone: events.timezone,
      location: events.location,
      organizerName: users.displayName,
      groupName: actors.name,
    })
    .from(events)
    .innerJoin(users, eq(events.organizerId, users.id))
    .innerJoin(actors, eq(events.groupActorId, actors.id))
    .where(
      and(
        eq(events.placeId, placeId),
        isNotNull(events.groupActorId),
      ),
    )
    .orderBy(events.startsAt);

  return Response.json({ events: placeEvents });
};
