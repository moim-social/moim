import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { Separator } from "~/components/ui/separator";
import {
  CalendarDays,
  Copy,
  Check,
  RefreshCw,
  Trash2,
  Bookmark,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import type { CalendarEvent } from "~/routes/users/-calendar-events";

export const Route = createFileRoute("/calendar/")({
  component: MyCalendarPage,
});

function MyCalendarPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [calendarToken, setCalendarToken] = useState<string | null>(null);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [calendarCopied, setCalendarCopied] = useState(false);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  useEffect(() => {
    fetch("/api/users/settings")
      .then((r) => {
        if (r.status === 401) {
          navigate({ to: "/auth/signin" });
          return null;
        }
        if (!r.ok) throw new Error("Failed to load");
        return r.json();
      })
      .then((data) => {
        if (!data) return;
        setCalendarToken(data.calendarToken ?? null);
        setLoading(false);
      })
      .catch(() => setLoading(false));

    fetch("/api/users/calendar-events")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.events) setCalendarEvents(data.events);
      })
      .catch(() => {});
  }, [navigate]);

  if (loading) {
    return <p className="text-muted-foreground">Loading...</p>;
  }

  return (
    <main className="mx-auto max-w-2xl space-y-6">
      <h2 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
        <CalendarDays className="size-6" />
        My Calendar
      </h2>

      <MonthlyCalendar
        events={calendarEvents}
        currentMonth={currentMonth}
        onMonthChange={setCurrentMonth}
      />

      <Separator />

      <Card className="rounded-lg">
        <CardContent className="pt-6 space-y-4">
          <div>
            <h3 className="text-lg font-semibold">Calendar Subscription</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Subscribe to a calendar feed of your RSVP&apos;d and bookmarked
              events in Google Calendar, Apple Calendar, or any calendar app.
            </p>
          </div>

          {calendarToken ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={`${window.location.origin}/calendar.ics?token=${calendarToken}`}
                  className="flex-1 h-9 rounded-md border border-input bg-muted px-3 py-1 text-sm font-mono truncate"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    await navigator.clipboard.writeText(
                      `${window.location.origin}/calendar.ics?token=${calendarToken}`,
                    );
                    setCalendarCopied(true);
                    setTimeout(() => setCalendarCopied(false), 2000);
                  }}
                >
                  {calendarCopied ? (
                    <Check className="size-4" />
                  ) : (
                    <Copy className="size-4" />
                  )}
                </Button>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={calendarLoading}
                  onClick={async () => {
                    if (
                      !confirm(
                        "Regenerating will invalidate the current URL. Any calendar apps using the old URL will stop syncing. Continue?",
                      )
                    )
                      return;
                    setCalendarLoading(true);
                    try {
                      const res = await fetch("/api/users/calendar-token", {
                        method: "POST",
                      });
                      if (res.ok) {
                        const data = await res.json();
                        setCalendarToken(data.calendarToken);
                      }
                    } finally {
                      setCalendarLoading(false);
                    }
                  }}
                >
                  <RefreshCw className="size-4 mr-1.5" />
                  Regenerate
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={calendarLoading}
                  onClick={async () => {
                    if (
                      !confirm(
                        "Revoking will stop all calendar apps from syncing your events. Continue?",
                      )
                    )
                      return;
                    setCalendarLoading(true);
                    try {
                      const res = await fetch("/api/users/calendar-token", {
                        method: "DELETE",
                      });
                      if (res.ok) {
                        setCalendarToken(null);
                      }
                    } finally {
                      setCalendarLoading(false);
                    }
                  }}
                >
                  <Trash2 className="size-4 mr-1.5" />
                  Revoke
                </Button>
              </div>
            </div>
          ) : (
            <Button
              variant="outline"
              disabled={calendarLoading}
              onClick={async () => {
                setCalendarLoading(true);
                try {
                  const res = await fetch("/api/users/calendar-token", {
                    method: "POST",
                  });
                  if (res.ok) {
                    const data = await res.json();
                    setCalendarToken(data.calendarToken);
                  }
                } finally {
                  setCalendarLoading(false);
                }
              }}
            >
              Generate Calendar URL
            </Button>
          )}
        </CardContent>
      </Card>
    </main>
  );
}

function MonthlyCalendar({
  events,
  currentMonth,
  onMonthChange,
}: {
  events: CalendarEvent[];
  currentMonth: Date;
  onMonthChange: (d: Date) => void;
}) {
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();

  const prevMonth = () => onMonthChange(new Date(year, month - 1, 1));
  const nextMonth = () => onMonthChange(new Date(year, month + 1, 1));
  const goToday = () => {
    const now = new Date();
    onMonthChange(new Date(now.getFullYear(), now.getMonth(), 1));
  };

  // Build event lookup by date key "YYYY-MM-DD"
  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const ev of events) {
      const d = new Date(ev.startsAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const arr = map.get(key) ?? [];
      arr.push(ev);
      map.set(key, arr);
    }
    return map;
  }, [events]);

  // Filter events for current month (list view)
  const monthEvents = useMemo(() => {
    return events.filter((ev) => {
      const d = new Date(ev.startsAt);
      return d.getFullYear() === year && d.getMonth() === month;
    });
  }, [events, year, month]);

  // Sorted dates with events for list view
  const datesWithEvents = useMemo(() => {
    const dateMap = new Map<string, CalendarEvent[]>();
    for (const ev of monthEvents) {
      const d = new Date(ev.startsAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const arr = dateMap.get(key) ?? [];
      arr.push(ev);
      dateMap.set(key, arr);
    }
    return Array.from(dateMap.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [monthEvents]);

  // Calendar grid: weeks × 7 days
  const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  const weeks: (number | null)[][] = [];
  let week: (number | null)[] = new Array(firstDay).fill(null);

  for (let day = 1; day <= daysInMonth; day++) {
    week.push(day);
    if (week.length === 7) {
      weeks.push(week);
      week = [];
    }
  }
  if (week.length > 0) {
    while (week.length < 7) week.push(null);
    weeks.push(week);
  }

  const monthLabel = currentMonth.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });

  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <Card className="rounded-lg">
      <CardContent className="pt-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">{monthLabel}</h3>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={goToday}>
              Today
            </Button>
            <Button variant="ghost" size="icon-sm" onClick={prevMonth}>
              <ChevronLeft className="size-4" />
            </Button>
            <Button variant="ghost" size="icon-sm" onClick={nextMonth}>
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>

        {/* Grid view (md+) */}
        <div className="hidden md:block">
          <div className="grid grid-cols-7 text-center text-xs font-medium text-muted-foreground">
            {dayNames.map((d) => (
              <div key={d} className="py-2">
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 border-t border-l">
            {weeks.flat().map((day, i) => {
              const dateKey = day
                ? `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
                : null;
              const dayEvents = dateKey
                ? eventsByDate.get(dateKey) ?? []
                : [];
              const isToday = dateKey === todayKey;

              return (
                <div
                  key={i}
                  className={`min-h-[72px] border-r border-b p-1 ${
                    day === null ? "bg-muted/30" : ""
                  }`}
                >
                  {day !== null && (
                    <>
                      <div
                        className={`text-xs mb-0.5 ${
                          isToday
                            ? "bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center font-bold"
                            : "text-muted-foreground"
                        }`}
                      >
                        {day}
                      </div>
                      <div className="space-y-0.5">
                        {dayEvents.slice(0, 3).map((ev) => (
                          <a
                            key={ev.id}
                            href={`/events/${ev.id}`}
                            className={`block text-[10px] leading-tight truncate rounded px-1 py-0.5 ${
                              ev.type === "rsvp"
                                ? "bg-primary/10 text-primary"
                                : ev.type === "hosting"
                                  ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                                  : "bg-amber-500/10 text-amber-700 dark:text-amber-400"
                            }`}
                            title={ev.title}
                          >
                            {ev.title}
                          </a>
                        ))}
                        {dayEvents.length > 3 && (
                          <span className="text-[10px] text-muted-foreground px-1">
                            +{dayEvents.length - 3} more
                          </span>
                        )}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* List view (mobile) */}
        <div className="md:hidden space-y-4">
          {datesWithEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No events this month.
            </p>
          ) : (
            datesWithEvents.map(([dateKey, dayEvents]) => {
              const date = new Date(dateKey + "T00:00:00");
              const isToday = dateKey === todayKey;
              return (
                <div key={dateKey}>
                  <div
                    className={`text-xs font-medium mb-2 ${isToday ? "text-primary" : "text-muted-foreground"}`}
                  >
                    {date.toLocaleDateString(undefined, {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                    })}
                    {isToday && " (Today)"}
                  </div>
                  <div className="space-y-2">
                    {dayEvents.map((ev) => (
                      <a
                        key={ev.id}
                        href={`/events/${ev.id}`}
                        className={`flex items-center gap-2 rounded-md border-l-2 border border-border px-3 py-1.5 hover:bg-muted/50 transition-colors ${
                          ev.type === "rsvp"
                            ? "border-l-primary bg-primary/5"
                            : ev.type === "hosting"
                              ? "border-l-emerald-500 bg-emerald-500/5"
                              : "border-l-amber-500 bg-amber-500/5"
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">
                            {ev.title}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(ev.startsAt).toLocaleTimeString(
                              undefined,
                              {
                                hour: "numeric",
                                minute: "2-digit",
                              },
                            )}
                            {ev.type === "favourite" && (
                              <span className="ml-1.5 inline-flex items-center gap-0.5">
                                <Bookmark className="size-2.5" />
                              </span>
                            )}
                          </p>
                        </div>
                      </a>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-2.5 rounded-sm bg-primary/20" />
            RSVP&apos;d
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-2.5 rounded-sm bg-emerald-500/20" />
            Hosting
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-2.5 rounded-sm bg-amber-500/20" />
            <Bookmark className="size-3" />
            Bookmarked
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
