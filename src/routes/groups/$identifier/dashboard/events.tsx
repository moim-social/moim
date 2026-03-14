import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { useEventCategoryMap } from "~/hooks/useEventCategories";
import { EmptyState, PageHeader } from "~/components/dashboard";
import { useGroupDashboard } from "./route";

export const Route = createFileRoute("/groups/$identifier/dashboard/events")({
  component: EventsTab,
});

function EventsTab() {
  const { categoryMap } = useEventCategoryMap();
  const { data } = useGroupDashboard();
  const { events } = data;

  const now = new Date();
  const upcomingEvents = events.filter((e) => new Date(e.startsAt) >= now);
  const pastEvents = events.filter((e) => new Date(e.startsAt) < now);
  const allEvents = [...upcomingEvents, ...pastEvents.reverse()];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <PageHeader
          title="Events"
          subtitle={`${events.length} total events.`}
        />
        <Button size="sm" asChild>
          <Link to="/events/create">Create Event</Link>
        </Button>
      </div>

      {allEvents.length === 0 ? (
        <EmptyState message="No events yet. Create your first event to get started." />
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-left text-muted-foreground">
                <th className="px-4 py-3 font-medium">Title</th>
                <th className="px-4 py-3 font-medium">Category</th>
                <th className="px-4 py-3 font-medium">Event Date</th>
                <th className="px-4 py-3 font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {allEvents.map((event) => {
                const isPast = new Date(event.startsAt) < now;
                const start = new Date(event.startsAt);
                const dateStr = start.toLocaleDateString(undefined, {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                });
                const timeStr = start.toLocaleTimeString(undefined, {
                  hour: "2-digit",
                  minute: "2-digit",
                });
                const created = new Date(event.createdAt);
                const createdStr = created.toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                });
                const createdTimeStr = created.toLocaleTimeString(undefined, {
                  hour: "2-digit",
                  minute: "2-digit",
                });

                return (
                  <tr
                    key={event.id}
                    className={`border-b last:border-b-0 transition-colors hover:bg-accent/50 ${
                      isPast ? "text-muted-foreground" : ""
                    }`}
                  >
                    <td className="px-4 py-3">
                      <Link
                        to="/events/$eventId/dashboard"
                        params={{ eventId: event.id }}
                        className="font-medium hover:underline hover:text-primary"
                      >
                        {event.title}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      {event.categoryId && (
                        <Badge variant="secondary" className="text-xs">
                          {categoryMap.get(event.categoryId) ??
                            event.categoryId}
                        </Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {dateStr} {timeStr}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {createdStr} {createdTimeStr}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
