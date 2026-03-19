import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { Clock, MapPin } from "lucide-react";
import type { CalendarEvent } from "~/components/EventCalendar";

type UpcomingEventListProps = {
  events: CalendarEvent[];
};

export function UpcomingEventList({ events }: UpcomingEventListProps) {
  const groupedUpcoming = useMemo(() => {
    const now = new Date();
    const upcoming = events
      .filter((e) => new Date(e.startsAt) >= now)
      .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());

    const groups: { dateLabel: string; events: CalendarEvent[] }[] = [];
    let currentLabel = "";
    for (const event of upcoming) {
      const start = new Date(event.startsAt);
      const label = start.toLocaleDateString(undefined, {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
        timeZone: event.timezone ?? undefined,
      });
      if (label !== currentLabel) {
        groups.push({ dateLabel: label, events: [] });
        currentLabel = label;
      }
      groups[groups.length - 1].events.push(event);
    }
    return groups;
  }, [events]);

  if (groupedUpcoming.length === 0) {
    return (
      <div className="rounded-lg border flex items-center justify-center py-16">
        <p className="text-sm text-muted-foreground">No upcoming events</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {groupedUpcoming.map((group) => (
        <div key={group.dateLabel}>
          <p className="text-md font-semibold text-foreground mb-2 px-1">{group.dateLabel}</p>
          <div className="rounded-lg border divide-y ml-4">
            {group.events.map((event) => {
              const start = new Date(event.startsAt);
              const evtTz = event.timezone ?? undefined;
              const timeStr = start.toLocaleTimeString(undefined, {
                hour: "2-digit",
                minute: "2-digit",
                timeZone: evtTz,
              });
              return (
                <Link
                  key={event.id}
                  to="/events/$eventId"
                  params={{ eventId: event.id }}
                  className="flex items-stretch hover:bg-accent/50 transition-colors first:rounded-t-lg last:rounded-b-lg"
                >
                  <div
                    className="shrink-0 rounded-l-lg bg-foreground/30"
                    style={{ width: 3 }}
                  />
                  <div className="flex-1 min-w-0 px-3 py-2.5">
                    <p className="text-sm font-medium leading-snug">{event.title}</p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock style={{ width: 12, height: 12 }} className="shrink-0" />
                        {timeStr}
                      </span>
                      {event.location && (
                        <span className="flex items-center gap-1 truncate">
                          <MapPin style={{ width: 12, height: 12 }} className="shrink-0" />
                          <span className="truncate">{event.location}</span>
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
