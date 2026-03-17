import { and, eq, isNull, asc } from "drizzle-orm";
import { db } from "~/server/db/client";
import { users, rsvps, events, actors, places, eventFavourites } from "~/server/db/schema";
import { buildIcsResponse, type IcsEvent } from "~/server/events/ics";

const PERSONAL_ICS_LIMIT = 500;

const eventSelect = {
  id: events.id,
  title: events.title,
  description: events.description,
  externalUrl: events.externalUrl,
  startsAt: events.startsAt,
  endsAt: events.endsAt,
  location: events.location,
  venueDetail: events.venueDetail,
  placeName: places.name,
  placeAddress: places.address,
  groupName: actors.name,
  groupHandle: actors.handle,
} as const;

export const GET = async ({
  request,
}: { request: Request }): Promise<Response> => {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");

  if (!token) {
    return new Response("Missing token", { status: 401 });
  }

  const [user] = await db
    .select({ id: users.id, displayName: users.displayName })
    .from(users)
    .where(eq(users.calendarToken, token))
    .limit(1);

  if (!user) {
    return new Response("Invalid token", { status: 401 });
  }

  // RSVP'd events (accepted)
  const rsvpRows = await db
    .select(eventSelect)
    .from(rsvps)
    .innerJoin(events, eq(rsvps.eventId, events.id))
    .innerJoin(actors, eq(events.groupActorId, actors.id))
    .leftJoin(places, eq(events.placeId, places.id))
    .where(
      and(
        eq(rsvps.userId, user.id),
        eq(rsvps.status, "accepted"),
        eq(events.published, true),
        isNull(events.deletedAt),
      ),
    )
    .orderBy(asc(events.startsAt))
    .limit(PERSONAL_ICS_LIMIT);

  // Favourited events
  const favouriteRows = await db
    .select(eventSelect)
    .from(eventFavourites)
    .innerJoin(events, eq(eventFavourites.eventId, events.id))
    .innerJoin(actors, eq(events.groupActorId, actors.id))
    .leftJoin(places, eq(events.placeId, places.id))
    .where(
      and(
        eq(eventFavourites.userId, user.id),
        eq(events.published, true),
        isNull(events.deletedAt),
      ),
    )
    .orderBy(asc(events.startsAt))
    .limit(PERSONAL_ICS_LIMIT);

  // Merge and deduplicate (RSVP takes precedence)
  const rsvpEventIds = new Set(rsvpRows.map((r) => r.id));
  const merged: IcsEvent[] = [
    ...rsvpRows,
    ...favouriteRows
      .filter((f) => !rsvpEventIds.has(f.id))
      .map((f) => ({ ...f, status: "TENTATIVE" as const })),
  ];

  // Sort by startsAt
  merged.sort(
    (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
  );

  return buildIcsResponse(merged, {
    calendarName: "My Moim Events",
    cacheControl: "private, max-age=900",
  });
};
