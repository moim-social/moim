import { createFileRoute } from "@tanstack/react-router";
import {
  StatCard,
  StatsGrid,
  DashboardSection,
  PageHeader,
} from "~/components/dashboard";
import { useGroupDashboard } from "./route";

export const Route = createFileRoute("/groups/$identifier/dashboard/")({
  component: OverviewTab,
});

function OverviewTab() {
  const { data } = useGroupDashboard();
  const { group, members, events, engagementCounts } = data;

  const now = new Date();
  const upcomingEvents = events.filter((e) => new Date(e.startsAt) >= now);
  const pastEvents = events.filter((e) => new Date(e.startsAt) < now);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Overview"
        subtitle="Group insights and engagement summary."
      />

      <DashboardSection title="Insights">
        <StatsGrid>
          <StatCard label="Followers" value={group.followersCount} />
          <StatCard label="Members" value={members.length} />
          <StatCard label="Upcoming" value={upcomingEvents.length} suffix="events" />
          <StatCard label="Past" value={pastEvents.length} suffix="events" />
        </StatsGrid>
      </DashboardSection>

      <DashboardSection title="Engagement">
        <StatsGrid>
          <StatCard label="Reactions" value={engagementCounts.reactions} />
          <StatCard label="Boosts" value={engagementCounts.announces} />
          <StatCard label="Replies" value={engagementCounts.replies} />
          <StatCard label="Quotes" value={engagementCounts.quotes} />
        </StatsGrid>
      </DashboardSection>
    </div>
  );
}
