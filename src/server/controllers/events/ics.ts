import { and, eq, gte, isNull, isNotNull, asc, type SQL } from "drizzle-orm";
import { db } from "~/server/db/client";
import { actors, events, places } from "~/server/db/schema";
import { buildIcsResponse } from "~/server/events/ics";
import { attachOrganizers } from "~/server/events/ics-organizers";

const ICS_LIMIT = 100;

export const GET = async ({
  request,
}: { request: Request }): Promise<Response> => {
  const url = new URL(request.url);
  const groupActorId = url.searchParams.get("groupActorId");
  const categoryId = url.searchParams.get("categoryId");
  const country = url.searchParams.get("country");
  const calendarName = url.searchParams.get("calendarName") ?? "Moim Events";

  const conditions: SQL[] = [
    eq(events.published, true),
    isNull(events.deletedAt),
    isNotNull(events.groupActorId),
    gte(events.startsAt, new Date()),
  ];
  if (groupActorId) conditions.push(eq(events.groupActorId, groupActorId));
  if (categoryId) conditions.push(eq(events.categoryId, categoryId));
  if (country) conditions.push(eq(events.country, country));

  const rows = await db
    .select({
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
      eventType: events.eventType,
      meetingUrl: events.meetingUrl,
    })
    .from(events)
    .innerJoin(actors, eq(events.groupActorId, actors.id))
    .leftJoin(places, eq(events.placeId, places.id))
    .where(and(...conditions))
    .orderBy(asc(events.startsAt))
    .limit(ICS_LIMIT);

  const icsEvents = await attachOrganizers(rows);
  return buildIcsResponse(icsEvents, { calendarName });
};
