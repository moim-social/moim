import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { CATEGORIES } from "~/shared/categories";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "~/components/ui/avatar";
import { Card, CardContent } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import {
  LayoutDashboard,
  Users,
  Activity,
  ArrowLeft,
  ExternalLink,
  Pencil,
  Search,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

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
  attendees: Attendee[];
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
  participantEngagement: ParticipantEngagement[];
};

type Attendee = {
  userId: string;
  handle: string | null;
  displayName: string;
  avatarUrl: string | null;
  status: string;
  createdAt: string;
};

type ParticipantEngagement = {
  actorId: string;
  actorHandle: string;
  actorName: string | null;
  reactionCount: number;
  replyCount: number;
  announceCount: number;
  totalEngagement: number;
};

type ActivityItem = {
  id: string;
  type: string;
  emoji: string | null;
  content: string | null;
  createdAt: string;
  actorId: string;
  actorHandle: string;
  actorName: string | null;
};

type Tab = "overview" | "attendees" | "activity";

function EventDashboard() {
  const { eventId } = Route.useParams();
  const navigate = useNavigate();

  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<Tab>("overview");

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

  if (loading) return <p className="text-muted-foreground p-6">Loading...</p>;
  if (error || !data)
    return <p className="text-destructive p-6">{error || "Not found"}</p>;

  const { event } = data;

  const statusVariant = {
    upcoming: "default" as const,
    ongoing: "default" as const,
    ended: "secondary" as const,
  };

  const NAV_ITEMS: { tab: Tab; icon: typeof LayoutDashboard; label: string }[] = [
    { tab: "overview", icon: LayoutDashboard, label: "Overview" },
    { tab: "attendees", icon: Users, label: "Attendees" },
    { tab: "activity", icon: Activity, label: "Activity" },
  ];

  return (
    <div className="-mx-6 -my-8 flex min-h-[calc(100vh-3.5rem)]">
      {/* Sidebar */}
      <aside className="flex w-56 shrink-0 flex-col border-r bg-muted/30">
        <div className="border-b p-4">
          <Link
            to="/events/$eventId"
            params={{ eventId }}
            className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            Back to Event
          </Link>
          <h1 className="mt-3 text-base font-semibold truncate" title={event.title}>
            {event.title}
          </h1>
          <div className="mt-1.5 flex items-center gap-1.5">
            <Badge variant={statusVariant[event.status]} className="text-xs">
              {event.status}
            </Badge>
            {event.categoryId && categoryMap.has(event.categoryId) && (
              <Badge variant="outline" className="text-xs">
                {categoryMap.get(event.categoryId)}
              </Badge>
            )}
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">
            {new Date(event.startsAt).toLocaleDateString(undefined, {
              weekday: "short",
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </div>

        <nav className="flex-1 space-y-0.5 p-3">
          {NAV_ITEMS.map((item) => {
            const isActive = activeTab === item.tab;
            return (
              <button
                key={item.tab}
                onClick={() => setActiveTab(item.tab)}
                className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors ${
                  isActive
                    ? "bg-accent font-medium text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                }`}
              >
                <item.icon className="size-4" />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="border-t p-3 space-y-1">
          <Link
            to="/events/$eventId"
            params={{ eventId }}
            className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground"
          >
            <ExternalLink className="size-4" />
            Public Page
          </Link>
          <Link
            to="/events/$eventId/edit"
            params={{ eventId }}
            className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground"
          >
            <Pencil className="size-4" />
            Edit Event
          </Link>
        </div>
      </aside>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {activeTab === "overview" && <OverviewTab data={data} />}
        {activeTab === "attendees" && <AttendeesTab data={data} />}
        {activeTab === "activity" && <ActivityTab eventId={eventId} />}
      </div>
    </div>
  );
}

// ── Overview Tab ────────────────────────────────────────────────────────────

function OverviewTab({ data }: { data: DashboardData }) {
  const { rsvpCounts, engagementCounts } = data;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Overview</h2>
        <p className="mt-1 text-muted-foreground">
          Event insights and engagement summary.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Attending" value={rsvpCounts.accepted} />
        <StatCard label="Total RSVPs" value={rsvpCounts.total} />
        <StatCard label="Reactions" value={engagementCounts.reactions} />
        <StatCard label="Boosts" value={engagementCounts.announces} />
        <StatCard label="Replies" value={engagementCounts.replies} />
        <StatCard label="Quotes" value={engagementCounts.quotes} />
      </div>
    </div>
  );
}

// ── Attendees Tab ───────────────────────────────────────────────────────────

function AttendeesTab({ data }: { data: DashboardData }) {
  const { attendees } = data;
  const [search, setSearch] = useState("");

  const filteredAttendees = attendees.filter((a) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      a.displayName.toLowerCase().includes(q) ||
      (a.handle?.toLowerCase().includes(q) ?? false)
    );
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Attendees</h2>
        <p className="mt-1 text-muted-foreground">
          RSVP list ({attendees.length} total).
        </p>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          placeholder="Search attendees..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {filteredAttendees.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">
          {search ? "No attendees match your search." : "No RSVPs yet."}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium">Attendee</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-left font-medium">RSVP Date</th>
              </tr>
            </thead>
            <tbody>
              {filteredAttendees.map((a) => (
                <tr key={a.userId} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Avatar className="size-8">
                        {a.avatarUrl && <AvatarImage src={a.avatarUrl} />}
                        <AvatarFallback className="text-xs">
                          {a.displayName.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <span className="font-medium">{a.displayName}</span>
                        {a.handle && (
                          <span className="text-muted-foreground ml-1.5 text-xs">
                            @{a.handle}
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={a.status === "accepted" ? "default" : "secondary"}>
                      {a.status === "accepted" ? "Attending" : "Not attending"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {new Date(a.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Activity Tab ────────────────────────────────────────────────────────────

const ACTIVITY_PAGE_SIZE = 20;

function ActivityTab({ eventId }: { eventId: string }) {
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<string | null>(null);

  const fetchActivity = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("limit", String(ACTIVITY_PAGE_SIZE));
    params.set("offset", String(offset));
    if (typeFilter) params.set("type", typeFilter);

    fetch(`/api/events/${eventId}/dashboard/activity?${params}`)
      .then((r) => r.json())
      .then((data) => {
        setItems(data.items ?? []);
        setTotal(data.total ?? 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [eventId, offset, typeFilter]);

  useEffect(() => {
    fetchActivity();
  }, [fetchActivity]);

  const typeFilters: { key: string | null; label: string }[] = [
    { key: null, label: "All" },
    { key: "replies", label: "Replies" },
    { key: "reactions", label: "Reactions" },
    { key: "reposts", label: "Reposts" },
  ];

  const totalPages = Math.ceil(total / ACTIVITY_PAGE_SIZE);
  const currentPage = Math.floor(offset / ACTIVITY_PAGE_SIZE) + 1;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Activity</h2>
        <p className="mt-1 text-muted-foreground">
          Engagement timeline.
        </p>
      </div>

      {/* Type Filters */}
      <div className="flex gap-1">
        {typeFilters.map((f) => (
          <Button
            key={f.key ?? "all"}
            variant={typeFilter === f.key ? "default" : "outline"}
            size="sm"
            className="text-xs h-7 px-2.5"
            onClick={() => {
              setTypeFilter(f.key);
              setOffset(0);
            }}
          >
            {f.label}
          </Button>
        ))}
      </div>

      {/* Activity List */}
      {loading ? (
        <p className="text-sm text-muted-foreground py-8 text-center">
          Loading activity...
        </p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">
          No engagement activity found.
        </p>
      ) : (
        <Card>
          <CardContent className="pt-6">
            <ul className="space-y-2">
              {items.map((a) => (
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
          </CardContent>
        </Card>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {currentPage} of {totalPages} ({total} items)
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={offset === 0}
              onClick={() => setOffset(Math.max(0, offset - ACTIVITY_PAGE_SIZE))}
            >
              <ChevronLeft className="size-4 mr-1" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={offset + ACTIVITY_PAGE_SIZE >= total}
              onClick={() => setOffset(offset + ACTIVITY_PAGE_SIZE)}
            >
              Next
              <ChevronRight className="size-4 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Shared Components ───────────────────────────────────────────────────────

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border p-4 space-y-2">
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <p className="text-3xl font-bold">{value}</p>
    </div>
  );
}
