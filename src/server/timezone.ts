import { env } from "~/server/env";

/**
 * Resolve effective timezone following the inheritance chain:
 * event timezone → group timezone → instance default
 */
export function resolveTimezone(
  eventTimezone?: string | null,
  groupTimezone?: string | null,
): string {
  return eventTimezone || groupTimezone || env.defaultTimezone;
}

/**
 * Format a date's components in the given timezone using ISO-like format.
 * Returns { date: "2026-03-27", time: "18:30" }
 */
function formatParts(date: Date, timezone: string): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "";

  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    time: `${get("hour")}:${get("minute")}`,
  };
}

/**
 * Get timezone abbreviation (e.g. "KST", "EST", "UTC").
 */
function getTimezoneAbbr(date: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    timeZoneName: "short",
  }).formatToParts(date);

  return parts.find((p) => p.type === "timeZoneName")?.value ?? timezone;
}

/**
 * Format event dates in ISO-like readable format.
 *
 * Same day:       2026-03-27 18:30 — 21:30 (KST)
 * Different days: 2026-03-27 18:30 — 2026-03-28 01:30 (KST)
 * No end time:    2026-03-27 18:30 (KST)
 */
export function formatEventDateRange(
  startsAt: Date,
  endsAt: Date | null | undefined,
  timezone: string,
): string {
  const start = formatParts(startsAt, timezone);
  const abbr = getTimezoneAbbr(startsAt, timezone);

  if (!endsAt) {
    return `${start.date} ${start.time} (${abbr})`;
  }

  const end = formatParts(endsAt, timezone);

  if (start.date === end.date) {
    // Same day: collapse the date
    return `${start.date} ${start.time} — ${end.time} (${abbr})`;
  }

  // Different days: show both dates
  return `${start.date} ${start.time} — ${end.date} ${end.time} (${abbr})`;
}
