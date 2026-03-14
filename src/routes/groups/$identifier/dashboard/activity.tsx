import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { FilterBar, EmptyState, PageHeader } from "~/components/dashboard";
import { useGroupDashboard } from "./route";

export const Route = createFileRoute(
  "/groups/$identifier/dashboard/activity",
)({
  component: ActivityTab,
});

const ACTIVITY_FILTERS = [
  { key: null, label: "All" },
  { key: "reply", label: "Replies" },
  { key: "reactions", label: "Reactions" },
  { key: "reposts", label: "Reposts" },
] as const;

function ActivityTab() {
  const { data } = useGroupDashboard();
  const { recentActivity } = data;
  const [activityFilter, setActivityFilter] = useState<string | null>(null);

  const filteredActivity = recentActivity.filter((a) => {
    if (activityFilter === null) return true;
    if (activityFilter === "reactions")
      return a.type === "like" || a.type === "emoji_react";
    if (activityFilter === "reposts") return a.type === "announce";
    if (activityFilter === "reply")
      return a.type === "reply" || a.type === "quote";
    return true;
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Recent Activity"
        subtitle="Fediverse engagement timeline."
      />

      <FilterBar
        filters={ACTIVITY_FILTERS.map((f) => ({
          key: f.key,
          label: f.label,
        }))}
        active={activityFilter}
        onChange={setActivityFilter}
      />

      {filteredActivity.length === 0 ? (
        <EmptyState message="No fediverse engagement yet." />
      ) : (
        <ul className="space-y-2">
          {filteredActivity.map((a) => (
            <li
              key={a.id}
              className="flex items-center gap-3 py-2 border-b last:border-b-0"
            >
              <span className="text-lg">
                {a.type === "like"
                  ? "\u2B50"
                  : a.type === "emoji_react"
                    ? a.emoji ?? "\u{1F600}"
                    : a.type === "announce"
                      ? "\u{1F501}"
                      : a.type === "quote"
                        ? "\u{1F4DD}"
                        : "\u{1F4AC}"}
              </span>
              <div className="min-w-0 flex-1">
                <span className="text-sm font-medium">
                  {a.actorName ?? a.actorHandle}
                </span>
                <span className="text-sm text-muted-foreground ml-1.5">
                  {a.type === "like"
                    ? "liked"
                    : a.type === "emoji_react"
                      ? `reacted with ${a.emoji}`
                      : a.type === "announce"
                        ? "boosted"
                        : a.type === "quote"
                          ? "quoted"
                          : "replied to"}
                </span>
                {a.eventTitle && a.eventId && (
                  <Link
                    to="/events/$eventId"
                    params={{ eventId: a.eventId }}
                    className="text-sm text-primary hover:underline ml-1"
                  >
                    {a.eventTitle}
                  </Link>
                )}
                {a.content &&
                  (a.type === "reply" || a.type === "quote") && (
                    <p
                      className="text-xs text-muted-foreground mt-1 line-clamp-2"
                      dangerouslySetInnerHTML={{ __html: a.content }}
                    />
                  )}
              </div>
              <span className="text-xs text-muted-foreground shrink-0">
                {new Date(a.createdAt).toLocaleString(undefined, {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
