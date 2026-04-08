import { eq, asc, and, isNull } from "drizzle-orm";
import { db } from "~/server/db/client";
import { eventFavourites, events, actors } from "~/server/db/schema";
import { getSessionUser } from "~/server/auth";

export const GET = async ({ request }: { request: Request }) => {
  const user = await getSessionUser(request);
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = await db
    .select({
      id: events.id,
      title: events.title,
      startsAt: events.startsAt,
      groupName: actors.name,
      groupHandle: actors.handle,
    })
    .from(eventFavourites)
    .innerJoin(events, eq(eventFavourites.eventId, events.id))
    .innerJoin(actors, eq(events.groupActorId, actors.id))
    .where(
      and(
        eq(eventFavourites.userId, user.id),
        eq(events.published, true),
        isNull(events.deletedAt),
      ),
    )
    .orderBy(asc(events.startsAt));

  return Response.json({ favourites: rows });
};
