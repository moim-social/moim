import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import { Button } from "~/components/ui/button";
import {
  Copy,
  Check,
  RefreshCw,
  Trash2,
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
    <main className="mx-auto max-w-3xl space-y-6">
      {/* Header */}
      <div className="pb-4 border-b-2 border-foreground">
        <h2 className="text-2xl font-extrabold tracking-tight">My Calendar</h2>
        <p className="text-sm text-muted-foreground mt-1">Your RSVP'd, hosted, and bookmarked events.</p>
      </div>

      <MonthlyCalendar
        events={calendarEvents}
        currentMonth={currentMonth}
        onMonthChange={setCurrentMonth}
      />

      {/* Calendar subscription */}
      <section className="border-t-2 border-foreground pt-5 space-y-4">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wide text-[#333]">Calendar Subscription</h3>
          <p className="text-sm text-muted-foreground mt-2">
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
      </section>
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
    <div className="space-y-4">
      {/* Month header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-extrabold tracking-tight">{monthLabel}</h3>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={goToday} className="text-[13px]">
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

        {/* Grid view (md+) — editorial ledger style */}
        <div className="hidden md:block">
          {/* Weekday headers */}
          <div className="grid grid-cols-7 border-b-2 border-foreground">
            {dayNames.map((d) => (
              <div key={d} className="py-1.5 text-center text-[11px] font-bold uppercase tracking-wide text-[#333]">
                {d}
              </div>
            ))}
          </div>

          {/* Weeks */}
          {weeks.map((week, wi) => (
            <div key={wi} className="grid grid-cols-7 border-b border-[#e5e5e5]">
              {week.map((day, di) => {
                const dateKey = day
                  ? `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
                  : null;
                const dayEvents = dateKey ? eventsByDate.get(dateKey) ?? [] : [];
                const isToday = dateKey === todayKey;
                const hasEvents = dayEvents.length > 0;

                return (
                  <div
                    key={di}
                    className={`min-h-[88px] p-2 ${
                      di < 6 ? "border-r border-[#f0f0f0]" : ""
                    } ${day === null ? "opacity-30" : ""}`}
                  >
                    {day !== null && (
                      <>
                        <div className={`text-[13px] mb-1.5 tabular-nums ${
                          isToday
                            ? "font-extrabold text-foreground"
                            : hasEvents
                              ? "font-semibold text-[#333]"
                              : "text-[#bbb]"
                        }`}>
                          {day}
                          {isToday && <span className="ml-1 text-[9px] font-bold uppercase tracking-wide align-middle">today</span>}
                        </div>
                        {dayEvents.slice(0, 3).map((ev) => (
                          <a
                            key={ev.id}
                            href={`/events/${ev.id}`}
                            className="block text-[10px] leading-snug truncate py-[1px] hover:underline"
                            title={ev.title}
                          >
                            <span className={`inline-block w-1.5 h-1.5 mr-1 align-middle ${
                              ev.type === "rsvp"
                                ? "bg-foreground"
                                : ev.type === "hosting"
                                  ? "bg-[#888]"
                                  : "bg-[#ccc]"
                            }`} />
                            <span className={
                              ev.type === "rsvp"
                                ? "font-semibold text-foreground"
                                : ev.type === "hosting"
                                  ? "font-medium text-[#555]"
                                  : "text-[#888]"
                            }>{ev.title}</span>
                          </a>
                        ))}
                        {dayEvents.length > 3 && (
                          <span className="text-[10px] text-[#999]">+{dayEvents.length - 3}</span>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {/* List view (mobile) */}
        <div className="md:hidden">
          {datesWithEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              No events this month.
            </p>
          ) : (
            <div className="space-y-5">
              {datesWithEvents.map(([dateKey, dayEvents]) => {
                const date = new Date(dateKey + "T00:00:00");
                const isTodayDate = dateKey === todayKey;
                return (
                  <div key={dateKey}>
                    <div className={`text-[11px] font-bold uppercase tracking-wide mb-2 pb-1 border-b border-[#e5e5e5] ${isTodayDate ? "text-foreground" : "text-[#888]"}`}>
                      {date.toLocaleDateString(undefined, {
                        weekday: "long",
                        month: "long",
                        day: "numeric",
                      })}
                      {isTodayDate && " — Today"}
                    </div>
                    <div className="divide-y divide-[#f0f0f0]">
                      {dayEvents.map((ev) => (
                        <a
                          key={ev.id}
                          href={`/events/${ev.id}`}
                          className={`flex items-center gap-3 py-2.5 pl-3 hover:bg-[#fafafa] transition-colors ${
                            ev.type === "rsvp"
                              ? "border-l-[3px] border-l-foreground"
                              : ev.type === "hosting"
                                ? "border-l-[3px] border-l-foreground/60"
                                : "border-l-[3px] border-l-[#ccc]"
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-[13px] font-semibold leading-snug">
                              {ev.title}
                            </p>
                            <p className="text-[11px] text-[#888] mt-0.5">
                              {new Date(ev.startsAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                            </p>
                          </div>
                          <span className={`shrink-0 text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-sm ${
                            ev.type === "rsvp"
                              ? "bg-foreground text-background"
                              : ev.type === "hosting"
                                ? "bg-[#e5e5e5] text-[#333]"
                                : "text-[#999]"
                          }`}>
                            {ev.type === "rsvp" ? "Going" : ev.type === "hosting" ? "Host" : "★"}
                          </span>
                        </a>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-5 text-[11px] text-[#888] pt-3">
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-1.5 h-1.5 bg-foreground" />
            RSVP&apos;d
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-1.5 h-1.5 bg-[#888]" />
            Hosting
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-1.5 h-1.5 bg-[#ccc]" />
            Bookmarked
          </div>
        </div>
    </div>
  );
}
