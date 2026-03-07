import { createFileRoute } from "@tanstack/react-router";
import { useDashboard } from "./route";

export const Route = createFileRoute("/events/$eventId/dashboard/")({
  component: OverviewTab,
});

function OverviewTab() {
  const { data } = useDashboard();
  const { rsvpCounts, engagementCounts } = data;
  const isGroupEvent = !!data.event.groupActorId;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Overview</h2>
        <p className="mt-1 text-muted-foreground">
          Event insights{isGroupEvent ? " and engagement summary" : ""}.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Attending" value={rsvpCounts.accepted} />
        <StatCard label="Total RSVPs" value={rsvpCounts.total} />
        {isGroupEvent && (
          <>
            <StatCard label="Reactions" value={engagementCounts.reactions} />
            <StatCard label="Boosts" value={engagementCounts.announces} />
            <StatCard label="Replies" value={engagementCounts.replies} />
            <StatCard label="Quotes" value={engagementCounts.quotes} />
          </>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border p-4 space-y-2">
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <p className="text-3xl font-bold">{value}</p>
    </div>
  );
}
