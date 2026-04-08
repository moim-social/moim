import { aliasedTable, eq, asc, and, isNull } from "drizzle-orm";
import { db } from "~/server/db/client";
import { rsvps, eventFavourites, events, actors, groupMembers } from "~/server/db/schema";
import { getSessionUser } from "~/server/auth";

export type CalendarEvent = {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string | null;
  groupName: string | null;
  groupHandle: string;
  type: "rsvp" | "hosting" | "favourite";
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

  // Hosted events (from groups the user is a member of)
  const memberActors = aliasedTable(actors, "member_actors");
  const hostingRows = await db
    .selectDistinctOn([events.id], eventSelect)
    .from(groupMembers)
    .innerJoin(memberActors, eq(groupMembers.memberActorId, memberActors.id))
    .innerJoin(events, eq(events.groupActorId, groupMembers.groupActorId))
    .innerJoin(actors, eq(events.groupActorId, actors.id))
    .where(
      and(
        eq(memberActors.userId, user.id),
        eq(memberActors.type, "Person"),
        eq(events.published, true),
        isNull(events.deletedAt),
      ),
    )
    .orderBy(events.id, asc(events.startsAt));

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

  // Merge and deduplicate (RSVP > hosting > favourite)
  const seenIds = new Set<string>();
  const merged: CalendarEvent[] = [];

  for (const r of rsvpRows) {
    seenIds.add(r.id);
    merged.push({ ...r, startsAt: r.startsAt.toISOString(), endsAt: r.endsAt?.toISOString() ?? null, type: "rsvp" });
  }
  for (const r of hostingRows) {
    if (seenIds.has(r.id)) continue;
    seenIds.add(r.id);
    merged.push({ ...r, startsAt: r.startsAt.toISOString(), endsAt: r.endsAt?.toISOString() ?? null, type: "hosting" });
  }
  for (const r of favouriteRows) {
    if (seenIds.has(r.id)) continue;
    seenIds.add(r.id);
    merged.push({ ...r, startsAt: r.startsAt.toISOString(), endsAt: r.endsAt?.toISOString() ?? null, type: "favourite" });
  }

  merged.sort(
    (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
  );

  return Response.json({ events: merged });
};
