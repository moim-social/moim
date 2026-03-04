import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CATEGORIES } from "~/shared/categories";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "~/components/ui/avatar";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";

export const Route = createFileRoute("/events/$eventId/dashboard")({
  component: EventDashboard,
});

const categoryMap = new Map<string, string>(
  CATEGORIES.map((c) => [c.id, c.label]),
);

type DashboardData = {
  event: {
    id: string;
    title: string;
    description: string | null;
    categoryId: string | null;
    startsAt: string;
    endsAt: string | null;
    location: string | null;
    status: "upcoming" | "ongoing" | "ended";
    createdAt: string;
  };
  rsvpCounts: {
    accepted: number;
    declined: number;
    total: number;
  };
  attendees: {
    userId: string;
    handle: string | null;
    displayName: string;
    avatarUrl: string | null;
    status: string;
    createdAt: string;
  }[];
  engagementCounts: {
    reactions: number;
    announces: number;
    replies: number;
    quotes: number;
  };
  recentActivity: {
    id: string;
    type: string;
    emoji: string | null;
    content: string | null;
    createdAt: string;
    actorHandle: string;
    actorName: string | null;
  }[];
};

function EventDashboard() {
  const { eventId } = Route.useParams();
  const navigate = useNavigate();

  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/events/${eventId}/dashboard`)
      .then((r) => {
        if (r.status === 403 || r.status === 400) {
          navigate({ to: "/events/$eventId", params: { eventId } });
          return null;
        }
        if (!r.ok) throw new Error("Failed to load dashboard");
        return r.json();
      })
      .then((d) => {
        if (d) setData(d);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [eventId, navigate]);

  if (loading) return <p className="text-muted-foreground">Loading...</p>;
  if (error || !data)
    return <p className="text-destructive">{error || "Not found"}</p>;

  const { event, rsvpCounts, attendees, engagementCounts, recentActivity } =
    data;

  const statusVariant = {
    upcoming: "default" as const,
    ongoing: "default" as const,
    ended: "secondary" as const,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-semibold tracking-tight truncate">
              {event.title}
            </h2>
            <Badge variant={statusVariant[event.status]}>{event.status}</Badge>
            {event.categoryId && categoryMap.has(event.categoryId) && (
              <Badge variant="outline">
                {categoryMap.get(event.categoryId)}
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {new Date(event.startsAt).toLocaleDateString(undefined, {
              weekday: "short",
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
            {event.endsAt &&
              ` — ${new Date(event.endsAt).toLocaleDateString(undefined, {
                weekday: "short",
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}`}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" asChild>
            <Link to="/events/$eventId" params={{ eventId }}>
              Public Page
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to="/events/$eventId/edit" params={{ eventId }}>
              Edit Event
            </Link>
          </Button>
        </div>
      </div>

      {/* Insights */}
      <Card className="rounded-lg">
        <CardHeader>
          <CardTitle className="text-base">Insights</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="rounded-lg border p-4 space-y-2">
              <p className="text-sm font-medium text-muted-foreground">
                Attending
              </p>
              <p className="text-3xl font-bold">{rsvpCounts.accepted}</p>
            </div>
            <div className="rounded-lg border p-4 space-y-2">
              <p className="text-sm font-medium text-muted-foreground">
                Total RSVPs
              </p>
              <p className="text-3xl font-bold">{rsvpCounts.total}</p>
            </div>
            <div className="rounded-lg border p-4 space-y-2">
              <p className="text-sm font-medium text-muted-foreground">
                Reactions
              </p>
              <p className="text-3xl font-bold">{engagementCounts.reactions}</p>
            </div>
            <div className="rounded-lg border p-4 space-y-2">
              <p className="text-sm font-medium text-muted-foreground">
                Boosts
              </p>
              <p className="text-3xl font-bold">{engagementCounts.announces}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Attendees */}
      <Card className="rounded-lg">
        <CardHeader>
          <CardTitle className="text-base">
            Attendees (
            {attendees.filter((a) => a.status === "accepted").length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {attendees.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No RSVPs yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-3 pr-4 font-medium">Name</th>
                    <th className="pb-3 pr-4 font-medium">Status</th>
                    <th className="pb-3 font-medium">RSVP Date</th>
                  </tr>
                </thead>
                <tbody>
                  {attendees.map((a) => (
                    <tr
                      key={a.userId}
                      className="border-b last:border-b-0"
                    >
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-2">
                          <Avatar className="size-8">
                            {a.avatarUrl && (
                              <AvatarImage src={a.avatarUrl} />
                            )}
                            <AvatarFallback className="text-xs">
                              {a.displayName.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <span className="font-medium">
                              {a.displayName}
                            </span>
                            {a.handle && (
                              <span className="text-muted-foreground ml-1.5">
                                @{a.handle}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 pr-4">
                        <Badge
                          variant={
                            a.status === "accepted" ? "default" : "secondary"
                          }
                        >
                          {a.status === "accepted"
                            ? "Attending"
                            : "Not attending"}
                        </Badge>
                      </td>
                      <td className="py-3 text-muted-foreground">
                        {new Date(a.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <Card className="rounded-lg">
        <CardHeader>
          <CardTitle className="text-base">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          {recentActivity.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No fediverse engagement yet.
            </p>
          ) : (
            <ul className="space-y-2">
              {recentActivity.map((a) => (
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
                    <span className="text-sm text-muted-foreground ml-1">
                      your post
                    </span>
                    {a.content && (a.type === "reply" || a.type === "quote") && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2"
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
        </CardContent>
      </Card>
    </div>
  );
}
