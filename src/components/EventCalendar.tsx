import { useState, useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { Calendar, ChevronLeft, ChevronRight, X } from "lucide-react";
import { Button } from "~/components/ui/button";
import { pickGradient } from "~/shared/gradients";
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
  organizerName?: string | null;
  groupName?: string | null;
};

type EventCalendarProps = {
  events: CalendarEvent[];
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function EventCalendar({ events }: EventCalendarProps) {
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
    } else {
      setCurrentMonth((m) => m - 1);
    }
  }

  function goToNextMonth() {
    setSelectedDate(null);
    if (currentMonth === 11) {
      setCurrentYear((y) => y + 1);
      setCurrentMonth(0);
    } else {
      setCurrentMonth((m) => m + 1);
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
        <span className="text-sm font-semibold">
          {formatMonthYear(currentYear, currentMonth)}
        </span>
        <Button variant="ghost" size="icon-xs" onClick={goToNextMonth}>
          <ChevronRight className="size-4" />
        </Button>
      </div>

      {/* Weekday headers */}
      <div className="grid" style={{ gridTemplateColumns: "repeat(7, 1fr)" }}>
        {WEEKDAYS.map((d) => (
          <div
            key={d}
            className="text-center text-xs font-medium text-muted-foreground py-1"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid w-full" style={{ gridTemplateColumns: "repeat(7, 1fr)" }}>
        {days.map((day, i) => {
          const inMonth = isCurrentMonth(day, currentYear, currentMonth);
          const today = isToday(day);
          const key = dateKey(day);
          const dayEvents = eventsMap.get(key) ?? [];
          const isSelected =
            selectedDate != null && isSameDay(day, selectedDate);

          return (
            <button
              key={i}
              type="button"
              onClick={() => handleDayClick(day)}
              className={cn(
                "flex flex-col items-center py-2 rounded-md transition-colors overflow-visible min-h-24",
                "text-xs sm:text-sm",
                "hover:bg-accent/50",
                !inMonth && "text-muted-foreground/40",
                isSelected && "bg-accent ring-1 ring-primary/30",
              )}
            >
              <span
                className={cn(
                  "size-6 flex items-center justify-center rounded-full text-xs sm:text-sm",
                  today && "bg-primary text-primary-foreground font-bold ring-2 ring-primary/30",
                )}
              >
                {day.getDate()}
              </span>
              {dayEvents.length > 0 && (
                <div className="flex gap-0.5 mt-1">
                  {dayEvents.slice(0, 3).map((evt) => {
                    const [color] = pickGradient(evt.categoryId || evt.id);
                    return (
                      <span
                        key={evt.id}
                        className="size-2 rounded-full"
                        style={{ backgroundColor: color }}
                      />
                    );
                  })}
                  {dayEvents.length > 3 && (
                    <span className="text-[9px] text-muted-foreground leading-none">
                      +{dayEvents.length - 3}
                    </span>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Selected day detail */}
      {selectedDate && (
        <div className="border rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold">
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
            <p className="text-sm text-muted-foreground">
              No events on this day.
            </p>
          ) : (
            <div className="space-y-2">
              {selectedEvents.map((evt) => {
                const start = new Date(evt.startsAt);
                const evtTz = evt.timezone ?? undefined;
                const timeStr = start.toLocaleTimeString(undefined, {
                  hour: "2-digit",
                  minute: "2-digit",
                  timeZone: evtTz,
                });
                const [color] = pickGradient(evt.categoryId || evt.id);

                return (
                  <Link
                    key={evt.id}
                    to="/events/$eventId"
                    params={{ eventId: evt.id }}
                    className="flex items-start gap-3 rounded-md p-2 hover:bg-accent/50 transition-colors"
                  >
                    <Calendar
                      className="size-4 mt-0.5 shrink-0"
                      style={{ color }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium leading-snug">
                        {evt.title}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                        <span>{timeStr}</span>
                        {evt.location && (
                          <>
                            <span>·</span>
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
