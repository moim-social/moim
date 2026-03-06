/**
 * Client-side timezone conversion utilities for datetime-local inputs.
 *
 * datetime-local inputs produce naive datetime strings (e.g. "2026-03-27T15:25")
 * with no timezone info. These helpers convert between naive strings and UTC,
 * using a specified IANA timezone.
 */

/** Convert a UTC ISO string to a datetime-local value in the given timezone. */
export function utcToDatetimeLocal(iso: string, tz?: string | null): string {
  const d = new Date(iso);
  if (tz) {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(d);
    const get = (type: string) =>
      parts.find((p) => p.type === type)?.value ?? "";
    return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
  }
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Convert a datetime-local value (interpreted in the given timezone) to a UTC ISO string. */
export function datetimeLocalToUTC(datetimeLocal: string, tz?: string | null): string {
  if (!tz) return new Date(datetimeLocal).toISOString();
  const [datePart, timePart] = datetimeLocal.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute] = timePart.split(":").map(Number);
  // Create a UTC instant with the same wall-clock values
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute);
  // See what wall-clock time that instant shows in the target timezone
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(utcGuess));
  const get = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value ?? 0);
  const tzWall = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"));
  // The offset is the difference; actual UTC = guess - offset
  return new Date(utcGuess - (tzWall - utcGuess)).toISOString();
}
