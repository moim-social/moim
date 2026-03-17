import { env } from "~/server/env";

export interface IcsEvent {
  id: string;
  title: string;
  description: string | null;
  externalUrl: string | null;
  startsAt: Date;
  endsAt: Date | null;
  location: string | null;
  venueDetail: string | null;
  placeName: string | null;
  placeAddress: string | null;
  groupName: string | null;
  groupHandle: string | null;
}

export interface IcsOptions {
  calendarName: string;
  cacheControl?: string;
  contentDisposition?: string;
}

export function escapeIcs(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

export function formatIcsDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

export function buildVevent(event: IcsEvent, baseUrl: string): string {
  const locationParts = [
    event.location || event.placeName || event.placeAddress || "",
    event.venueDetail,
  ].filter(Boolean);
  const location = locationParts.join(" — ");
  const lines = [
    "BEGIN:VEVENT",
    `UID:${event.id}@${new URL(baseUrl).hostname}`,
    `DTSTART:${formatIcsDate(new Date(event.startsAt))}`,
  ];
  if (event.endsAt) {
    lines.push(`DTEND:${formatIcsDate(new Date(event.endsAt))}`);
  }
  lines.push(`SUMMARY:${escapeIcs(event.title)}`);
  if (location) {
    lines.push(`LOCATION:${escapeIcs(location)}`);
  }
  const organizer = event.groupName ?? (event.groupHandle ? `@${event.groupHandle}` : "");
  const eventUrl = event.externalUrl || `${baseUrl}/events/${event.id}`;
  const descParts: string[] = [];
  if (organizer) descParts.push(`Hosted by: ${organizer}`);
  descParts.push(`Link: ${eventUrl}`);
  if (event.description) {
    const plain = event.description.replace(/<[^>]*>/g, "");
    descParts.push("", plain);
  }
  lines.push(`DESCRIPTION:${escapeIcs(descParts.join("\n"))}`);
  if (organizer) {
    lines.push(`ORGANIZER;CN=${escapeIcs(organizer)}:mailto:noreply@${new URL(baseUrl).hostname}`);
  }
  lines.push(`URL:${eventUrl}`);
  lines.push("END:VEVENT");
  return lines.join("\r\n");
}

export function buildIcsResponse(
  events: IcsEvent[],
  options: IcsOptions,
): Response {
  const baseUrl = env.baseUrl;

  const vevents = events.map((e) => buildVevent(e, baseUrl));

  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Moim//Events//EN",
    `X-WR-CALNAME:${escapeIcs(options.calendarName)}`,
    ...vevents,
    "END:VCALENDAR",
  ].join("\r\n");

  const headers: Record<string, string> = {
    "Content-Type": "text/calendar; charset=utf-8",
    "Cache-Control": options.cacheControl ?? "public, max-age=900",
  };
  if (options.contentDisposition) {
    headers["Content-Disposition"] = options.contentDisposition;
  }

  return new Response(ics, { headers });
}
