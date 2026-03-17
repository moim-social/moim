import { eq, asc, and, isNull } from "drizzle-orm";
import { db } from "~/server/db/client";
import { rsvps, eventFavourites, events, actors } from "~/server/db/schema";
import { getSessionUser } from "~/server/auth";

export type CalendarEvent = {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string | null;
  groupName: string | null;
  groupHandle: string;
  type: "rsvp" | "favourite";
};

export const GET = async ({ request }: { request: Request }) => {
  const user = await getSessionUser(request);
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const eventSelect = {
    id: events.id,
    title: events.title,
    startsAt: events.startsAt,
    endsAt: events.endsAt,
    groupName: actors.name,
    groupHandle: actors.handle,
  };

  const rsvpRows = await db
    .select(eventSelect)
    .from(rsvps)
    .innerJoin(events, eq(rsvps.eventId, events.id))
    .innerJoin(actors, eq(events.groupActorId, actors.id))
    .where(
      and(
        eq(rsvps.userId, user.id),
        eq(rsvps.status, "accepted"),
        eq(events.published, true),
        isNull(events.deletedAt),
      ),
    )
    .orderBy(asc(events.startsAt));

  const favouriteRows = await db
    .select(eventSelect)
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

  // Merge and deduplicate (RSVP takes precedence)
  const rsvpEventIds = new Set(rsvpRows.map((r) => r.id));
  const merged: CalendarEvent[] = [
    ...rsvpRows.map((r) => ({ ...r, startsAt: r.startsAt.toISOString(), endsAt: r.endsAt?.toISOString() ?? null, type: "rsvp" as const })),
    ...favouriteRows
      .filter((f) => !rsvpEventIds.has(f.id))
      .map((f) => ({ ...f, startsAt: f.startsAt.toISOString(), endsAt: f.endsAt?.toISOString() ?? null, type: "favourite" as const })),
  ];

  merged.sort(
    (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
  );

  return Response.json({ events: merged });
};
