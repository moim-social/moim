import { useState, useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";
import {
  getCalendarGrid,
  isSameDay,
  isCurrentMonth,
  isToday,
  eventOverlapsDay,
  formatMonthYear,
  dateKey,
} from "~/lib/calendar";

export type CalendarEvent = {
  id: string;
  title: string;
  categoryId: string;
  startsAt: string;
  endsAt: string | null;
  timezone: string | null;
  location: string | null;
  country?: string | null;
  organizerName?: string | null;
  groupName?: string | null;
};

type EventCalendarProps = {
  events: CalendarEvent[];
  /** When true, show country tag per event; when false (default), show venue */
  showCountry?: boolean;
  /** Called when the visible month changes */
  onMonthChange?: (year: number, month: number) => void;
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function EventCalendar({ events, showCountry = false, onMonthChange }: EventCalendarProps) {
  const now = new Date();
  const [currentYear, setCurrentYear] = useState(now.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(now.getMonth());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const days = useMemo(
    () => getCalendarGrid(currentYear, currentMonth),
    [currentYear, currentMonth],
  );

  const eventsMap = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const event of events) {
      const start = new Date(event.startsAt);
      const end = event.endsAt ? new Date(event.endsAt) : null;
      for (const day of days) {
        if (eventOverlapsDay(start, end, day)) {
          const key = dateKey(day);
          const list = map.get(key) ?? [];
          list.push(event);
          map.set(key, list);
        }
      }
    }
    return map;
  }, [events, days]);

  const selectedEvents = selectedDate
    ? (eventsMap.get(dateKey(selectedDate)) ?? [])
    : [];

  function goToPrevMonth() {
    setSelectedDate(null);
    if (currentMonth === 0) {
      setCurrentYear((y) => y - 1);
      setCurrentMonth(11);
      onMonthChange?.(currentYear - 1, 11);
    } else {
      setCurrentMonth((m) => m - 1);
      onMonthChange?.(currentYear, currentMonth - 1);
    }
  }

  function goToNextMonth() {
    setSelectedDate(null);
    if (currentMonth === 11) {
      setCurrentYear((y) => y + 1);
      setCurrentMonth(0);
      onMonthChange?.(currentYear + 1, 0);
    } else {
      setCurrentMonth((m) => m + 1);
      onMonthChange?.(currentYear, currentMonth + 1);
    }
  }

  function handleDayClick(day: Date) {
    if (!isCurrentMonth(day, currentYear, currentMonth)) {
      setCurrentYear(day.getFullYear());
      setCurrentMonth(day.getMonth());
    }
    setSelectedDate(day);
  }

  return (
    <div className="space-y-4">
      {/* Navigation header */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="icon-xs" onClick={goToPrevMonth}>
          <ChevronLeft className="size-4" />
        </Button>
        <span className="text-sm font-extrabold tracking-tight">
          {formatMonthYear(currentYear, currentMonth)}
        </span>
        <Button variant="ghost" size="icon-xs" onClick={goToNextMonth}>
          <ChevronRight className="size-4" />
        </Button>
      </div>

      {/* Weekday headers */}
      <div className="grid border-b border-[#e5e5e5]" style={{ gridTemplateColumns: "repeat(7, 1fr)" }}>
        {WEEKDAYS.map((d) => (
          <div
            key={d}
            className="text-center text-[11px] font-bold uppercase tracking-wide text-[#888] py-2"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      {(() => {
        const weeks: Date[][] = [];
        for (let i = 0; i < days.length; i += 7) {
          weeks.push(days.slice(i, i + 7));
        }
        return weeks.map((week, wi) => (
          <div key={wi} className="grid w-full border-b border-[#e5e5e5]" style={{ gridTemplateColumns: "repeat(7, 1fr)" }}>
            {week.map((day, di) => {
              const inMonth = isCurrentMonth(day, currentYear, currentMonth);
              const todayDay = isToday(day);
              const key = dateKey(day);
              const dayEvents = eventsMap.get(key) ?? [];
              const isSelected = selectedDate != null && isSameDay(day, selectedDate);
              const hasEvents = dayEvents.length > 0;

              return (
                <button
                  key={di}
                  type="button"
                  onClick={() => handleDayClick(day)}
                  className={cn(
                    "flex flex-col items-start p-1.5 text-left min-h-[96px] transition-colors",
                    di < 6 && "border-r border-[#f0f0f0]",
                    !inMonth && "opacity-25",
                    isSelected && "bg-[#f5f5f5]",
                  )}
                >
                  <span className={cn(
                    "text-[12px] tabular-nums mb-1",
                    todayDay
                      ? "font-extrabold text-foreground underline underline-offset-2"
                      : hasEvents
                        ? "font-semibold text-[#333]"
                        : "text-[#ccc]",
                  )}>
                    {day.getDate()}
                  </span>
                  {dayEvents.slice(0, 2).map((evt) => {
                    const start = new Date(evt.startsAt);
                    const timeStr = start.toLocaleTimeString(undefined, {
                      hour: "2-digit",
                      minute: "2-digit",
                      timeZone: evt.timezone ?? undefined,
                    });
                    return (
                      <div
                        key={evt.id}
                        className="w-full border-l-2 border-l-foreground/40 pl-1 mb-0.5 truncate"
                        title={evt.title}
                      >
                        <span className="text-[9px] text-[#999]">{timeStr}</span>
                        <p className="text-[10px] font-medium leading-tight truncate">{evt.title}</p>
                      </div>
                    );
                  })}
                  {dayEvents.length > 2 && (
                    <span className="text-[9px] text-[#999] pl-1">+{dayEvents.length - 2} more</span>
                  )}
                </button>
              );
            })}
          </div>
        ));
      })()}

      {/* Selected day detail */}
      {selectedDate && (
        <div className="border-t-2 border-foreground pt-4 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wide text-[#333]">
              {selectedDate.toLocaleDateString(undefined, {
                weekday: "long",
                month: "long",
                day: "numeric",
              })}
            </h4>
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => setSelectedDate(null)}
            >
              <X className="size-3.5" />
            </Button>
          </div>

          {selectedEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">
              No events on this day.
            </p>
          ) : (
            <div className="divide-y divide-[#f0f0f0]">
              {selectedEvents.map((evt) => {
                const start = new Date(evt.startsAt);
                const evtTz = evt.timezone ?? undefined;
                const timeStr = start.toLocaleTimeString(undefined, {
                  hour: "2-digit",
                  minute: "2-digit",
                  timeZone: evtTz,
                });

                return (
                  <Link
                    key={evt.id}
                    to="/events/$eventId"
                    params={{ eventId: evt.id }}
                    className="flex items-start gap-3 py-3 first:pt-0 hover:bg-[#fafafa] transition-colors group"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold leading-snug group-hover:underline">
                        {evt.title}
                      </p>
                      <div className="flex items-center gap-2 text-[11px] text-[#888] mt-0.5">
                        <span>{timeStr}</span>
                        {evt.location && (
                          <>
                            <span className="text-[#ddd]">&middot;</span>
                            <span className="truncate">{evt.location}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
