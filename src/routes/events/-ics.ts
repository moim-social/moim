import { and, eq, gte, isNull, isNotNull, asc, type SQL } from "drizzle-orm";
import { db } from "~/server/db/client";
import { events, places } from "~/server/db/schema";
import { env } from "~/server/env";

const ICS_LIMIT = 100;

function escapeIcs(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

function formatIcsDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

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
      startsAt: events.startsAt,
      endsAt: events.endsAt,
      location: events.location,
      placeName: places.name,
      placeAddress: places.address,
    })
    .from(events)
    .leftJoin(places, eq(events.placeId, places.id))
    .where(and(...conditions))
    .orderBy(asc(events.startsAt))
    .limit(ICS_LIMIT);

  const baseUrl = env.baseUrl;

  const vevents = rows.map((e) => {
    const location = e.location || e.placeName || e.placeAddress || "";
    const lines = [
      "BEGIN:VEVENT",
      `UID:${e.id}@${new URL(baseUrl).hostname}`,
      `DTSTART:${formatIcsDate(new Date(e.startsAt))}`,
    ];
    if (e.endsAt) {
      lines.push(`DTEND:${formatIcsDate(new Date(e.endsAt))}`);
    }
    lines.push(`SUMMARY:${escapeIcs(e.title)}`);
    if (location) {
      lines.push(`LOCATION:${escapeIcs(location)}`);
    }
    if (e.description) {
      const plain = e.description.replace(/<[^>]*>/g, "");
      lines.push(`DESCRIPTION:${escapeIcs(plain)}`);
    }
    lines.push(`URL:${baseUrl}/events/${e.id}`);
    lines.push("END:VEVENT");
    return lines.join("\r\n");
  });

  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Moim//Events//EN",
    `X-WR-CALNAME:${escapeIcs(calendarName)}`,
    ...vevents,
    "END:VCALENDAR",
  ].join("\r\n");

  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Cache-Control": "public, max-age=900",
    },
  });
};
