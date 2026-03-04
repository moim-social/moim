/**
 * Pure calendar date utilities using native Date API.
 */

/** Return a 42-element array of Dates (6 weeks × 7 days) for a month grid starting on Sunday. */
export function getCalendarGrid(year: number, month: number): Date[] {
  const firstDay = new Date(year, month, 1);
  const startOffset = firstDay.getDay(); // 0 = Sunday
  const gridStart = new Date(year, month, 1 - startOffset);

  const days: Date[] = [];
  for (let i = 0; i < 42; i++) {
    days.push(new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i));
  }
  return days;
}

/** Check whether two Dates fall on the same calendar day. */
export function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

/** Check whether a Date falls within a given year/month. */
export function isCurrentMonth(date: Date, year: number, month: number): boolean {
  return date.getFullYear() === year && date.getMonth() === month;
}

/** Check whether a Date is today. */
export function isToday(date: Date): boolean {
  return isSameDay(date, new Date());
}

/** Strip time from a Date, returning midnight of that day. */
function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/**
 * Check whether an event overlaps with a particular calendar day.
 * - Point events (endsAt is null): overlaps if startsAt is on that day.
 * - Ranged events: overlaps if the day falls between startsAt and endsAt (inclusive, date-only).
 */
export function eventOverlapsDay(
  startsAt: Date,
  endsAt: Date | null,
  day: Date,
): boolean {
  const dayStart = startOfDay(day).getTime();
  const eventStart = startOfDay(startsAt).getTime();

  if (endsAt == null) {
    return dayStart === eventStart;
  }

  const eventEnd = startOfDay(endsAt).getTime();
  return dayStart >= eventStart && dayStart <= eventEnd;
}

/** Format a month/year as e.g. "March 2026". */
export function formatMonthYear(year: number, month: number): string {
  const d = new Date(year, month, 1);
  return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

/** Format a date key as "YYYY-MM-DD" for use as a Map key. */
export function dateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
