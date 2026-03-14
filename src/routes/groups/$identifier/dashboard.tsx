import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useEventCategoryMap } from "~/hooks/useEventCategories";
import { languageLabel } from "~/shared/languages";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "~/components/ui/avatar";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Separator } from "~/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Textarea } from "~/components/ui/textarea";
import { MarkdownEditor } from "~/components/MarkdownEditor";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { PlaceCategorySelect } from "~/components/PlaceCategorySelect";
import type { PlaceCategoryOption, PlaceCategorySummary } from "~/lib/place";

export const Route = createFileRoute("/groups/$identifier/dashboard")({
  component: GroupDashboard,
});

type GroupData = {
  group: {
    id: string;
    handle: string;
    name: string | null;
    summary: string | null;
    website: string | null;
    avatarUrl: string | null;
    categories: string[] | null;
    language: string | null;
    followersCount: number;
    createdAt: string;
  };
  members: {
    role: string;
    handle: string;
    name: string | null;
    actorUrl: string;
    isLocal: boolean;
  }[];
  followers: {
    handle: string;
    name: string | null;
    actorUrl: string;
    domain: string | null;
    isLocal: boolean;
  }[];
  events: {
    id: string;
    title: string;
    description: string | null;
    categoryId: string;
    startsAt: string;
    endsAt: string | null;
    location: string | null;
    createdAt: string;
  }[];
  places: {
    id: string;
    name: string;
    description: string | null;
    address: string | null;
    latitude: string | null;
    longitude: string | null;
    category: PlaceCategorySummary | null;
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
    eventId: string | null;
    eventTitle: string | null;
  }[];
  currentUserRole: string | null;
};

type PollData = {
  id: string;
  questionId: string;
  question: string;
  type: "single" | "multiple";
  closed: boolean;
  expiresAt: string | null;
  createdAt: string;
  options: { id: string; label: string; sortOrder: number; count: number }[];
  totalVoters: number;
};

const GAUGE_COLORS = [
  "#3b82f6", // blue
  "#f59e0b", // amber
  "#10b981", // emerald
  "#ef4444", // red
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#06b6d4", // cyan
  "#f97316", // orange
  "#6366f1", // indigo
  "#14b8a6", // teal
];

function GroupDashboard() {
  const { categoryMap } = useEventCategoryMap();
  const { identifier } = Route.useParams();
  const navigate = useNavigate();
  const handle = identifier.replace(/^@/, "");

  const [data, setData] = useState<GroupData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [activityFilter, setActivityFilter] = useState<"all" | "reactions" | "reposts" | "reply">("all");

  // Post Note dialog
  const [noteDialogOpen, setNoteDialogOpen] = useState(false);
  const [noteContent, setNoteContent] = useState("");
  const [noteSubmitting, setNoteSubmitting] = useState(false);
  const [noteError, setNoteError] = useState("");
  const [noteSuccess, setNoteSuccess] = useState(false);

  // Create Poll dialog
  const [pollDialogOpen, setPollDialogOpen] = useState(false);
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollType, setPollType] = useState<"single" | "multiple">("single");
  const [pollOptions, setPollOptions] = useState(["", ""]);
  const [pollExpiresIn, setPollExpiresIn] = useState("");
  const [pollSubmitting, setPollSubmitting] = useState(false);
  const [pollError, setPollError] = useState("");

  // Polls data
  const [pollsData, setPollsData] = useState<PollData[]>([]);
  const [pollsLoading, setPollsLoading] = useState(false);

  useEffect(() => {
    fetch(`/api/groups/by-handle/${encodeURIComponent(handle)}`)
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load group");
        return r.json();
      })
      .then((d) => {
        if (!d.currentUserRole) {
          navigate({ to: "/groups/$identifier", params: { identifier } });
          return;
        }
        setData(d);
        setLoading(false);
        fetchPolls(d.group.id);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [handle, identifier, navigate]);

  function fetchPolls(groupId: string) {
    setPollsLoading(true);
    fetch(`/api/groups/${groupId}/polls?limit=50`)
      .then((r) => r.json())
      .then((d) => setPollsData(d.polls ?? []))
      .catch(() => {})
      .finally(() => setPollsLoading(false));
  }

  async function submitPoll() {
    if (!data) return;
    setPollSubmitting(true);
    setPollError("");
    try {
      const validOptions = pollOptions.filter((o) => o.trim());
      if (validOptions.length < 2) {
        setPollError("At least 2 options are required");
        setPollSubmitting(false);
        return;
      }
      const expiresAt = pollExpiresIn
        ? new Date(Date.now() + parseInt(pollExpiresIn, 10) * 3600_000).toISOString()
        : undefined;
      const res = await fetch(`/api/groups/${data.group.id}/polls`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: pollQuestion,
          type: pollType,
          options: validOptions,
          expiresAt,
        }),
      });
      const result = await res.json();
      if (!res.ok) {
        setPollError(result.error ?? "Failed to create poll");
        setPollSubmitting(false);
        return;
      }
      setPollQuestion("");
      setPollType("single");
      setPollOptions(["", ""]);
      setPollExpiresIn("");
      setPollDialogOpen(false);
      fetchPolls(data.group.id);
    } catch {
      setPollError("Network error");
    }
    setPollSubmitting(false);
  }

  async function submitNote() {
    if (!data) return;
    setNoteSubmitting(true);
    setNoteError("");
    setNoteSuccess(false);
    try {
      const res = await fetch(`/api/groups/${data.group.id}/posts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: noteContent }),
      });
      const result = await res.json();
      if (!res.ok) {
        setNoteError(result.error ?? "Failed to post note");
        setNoteSubmitting(false);
        return;
      }
      setNoteContent("");
      setNoteSuccess(true);
      setNoteDialogOpen(false);
      // Refresh data to show new post
      const refreshRes = await fetch(`/api/groups/by-handle/${encodeURIComponent(handle)}`);
      const refreshData = await refreshRes.json();
      setData(refreshData);
    } catch {
      setNoteError("Network error");
    }
    setNoteSubmitting(false);
  }

  if (loading) {
    return <p className="text-muted-foreground">Loading...</p>;
  }

  if (error || !data) {
    return (
      <p className="text-destructive">{error || "Group not found"}</p>
    );
  }

  const { group, members, followers, events, engagementCounts, recentActivity } = data;

  const filteredActivity = recentActivity.filter((a) => {
    if (activityFilter === "all") return true;
    if (activityFilter === "reactions") return a.type === "like" || a.type === "emoji_react";
    if (activityFilter === "reposts") return a.type === "announce";
    if (activityFilter === "reply") return a.type === "reply" || a.type === "quote";
    return true;
  });
  const owners = members.filter((m) => m.role === "owner");
  const moderators = members.filter((m) => m.role === "moderator");

  const now = new Date();
  const upcomingEvents = events.filter(
    (e) => new Date(e.startsAt) >= now,
  );
  const pastEvents = events.filter(
    (e) => new Date(e.startsAt) < now,
  );
  // Show upcoming first, then past (most recent first)
  const allEvents = [...upcomingEvents, ...pastEvents.reverse()];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0">
          <Avatar className="size-14 shrink-0">
            {group.avatarUrl && <AvatarImage src={group.avatarUrl} alt={group.name ?? handle} />}
            <AvatarFallback className="text-xl font-semibold bg-primary/10 text-primary">
              {(group.name ?? handle).charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-semibold tracking-tight truncate">
                {group.name ?? `@${handle}`}
              </h2>
              <Badge variant="outline" className="shrink-0">
                {data.currentUserRole}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">@{handle}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" asChild>
            <Link to="/groups/$identifier" params={{ identifier }}>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-4 mr-1">
                <path fillRule="evenodd" d="M4.25 5.5a.75.75 0 0 0-.75.75v8.5c0 .414.336.75.75.75h8.5a.75.75 0 0 0 .75-.75v-4a.75.75 0 0 1 1.5 0v4A2.25 2.25 0 0 1 12.75 17h-8.5A2.25 2.25 0 0 1 2 14.75v-8.5A2.25 2.25 0 0 1 4.25 4h5a.75.75 0 0 1 0 1.5h-5Zm4.943.25a.75.75 0 0 1 0-1.5h5.057a.75.75 0 0 1 .75.75v5.057a.75.75 0 0 1-1.5 0V6.56l-5.22 5.22a.75.75 0 0 1-1.06-1.06l5.22-5.22H9.193Z" clipRule="evenodd" />
              </svg>
              Public Page
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to="/groups/$identifier/edit" params={{ identifier }}>
              Edit Group
            </Link>
          </Button>
          <Button variant="outline" size="sm" onClick={() => { setNoteDialogOpen(true); setNoteSuccess(false); setNoteError(""); }}>
            Post Note
          </Button>
          <Button variant="outline" size="sm" onClick={() => { setPollDialogOpen(true); setPollError(""); }}>
            Create Poll
          </Button>
          <Button size="sm" asChild>
            <Link to="/events/create">Create Event</Link>
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
              <p className="text-sm font-medium text-muted-foreground">Followers</p>
              <p className="text-3xl font-bold">{group.followersCount}</p>
            </div>
            <div className="rounded-lg border p-4 space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Members</p>
              <p className="text-3xl font-bold">{members.length}</p>
            </div>
            <div className="rounded-lg border p-4 space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Upcoming</p>
              <p className="text-3xl font-bold">{upcomingEvents.length}<span className="text-base font-normal text-muted-foreground ml-1">events</span></p>
            </div>
            <div className="rounded-lg border p-4 space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Past</p>
              <p className="text-3xl font-bold">{pastEvents.length}<span className="text-base font-normal text-muted-foreground ml-1">events</span></p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Engagement */}
      <Card className="rounded-lg">
        <CardHeader>
          <CardTitle className="text-base">Engagement</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="rounded-lg border p-4 space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Reactions</p>
              <p className="text-3xl font-bold">{engagementCounts.reactions}</p>
            </div>
            <div className="rounded-lg border p-4 space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Boosts</p>
              <p className="text-3xl font-bold">{engagementCounts.announces}</p>
            </div>
            <div className="rounded-lg border p-4 space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Replies</p>
              <p className="text-3xl font-bold">{engagementCounts.replies}</p>
            </div>
            <div className="rounded-lg border p-4 space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Quotes</p>
              <p className="text-3xl font-bold">{engagementCounts.quotes}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Polls */}
      <Card className="rounded-lg">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">
            Polls ({pollsData.length})
          </CardTitle>
          <Button size="sm" variant="outline" onClick={() => { setPollDialogOpen(true); setPollError(""); }}>
            Create Poll
          </Button>
        </CardHeader>
        <CardContent>
          {pollsLoading ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Loading polls...</p>
          ) : pollsData.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No polls yet. Create one to engage your community.
            </p>
          ) : (
            <div className="space-y-4">
              {pollsData.map((poll) => {
                const totalVotes = poll.options.reduce((s, o) => s + o.count, 0);
                const isExpired = poll.expiresAt && new Date(poll.expiresAt).getTime() < Date.now();
                return (
                  <div key={poll.id} className="rounded-lg border p-4 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium">{poll.question}</p>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Badge variant="secondary" className="text-xs">
                          {poll.type === "single" ? "Single choice" : "Multiple choice"}
                        </Badge>
                        {(poll.closed || isExpired) && (
                          <Badge variant="outline" className="text-xs">Closed</Badge>
                        )}
                      </div>
                    </div>
                    {/* Per-option gauge bars */}
                    <div className="space-y-2.5">
                      {poll.options.map((option, i) => {
                        const pct = totalVotes > 0 ? Math.round((option.count / totalVotes) * 100) : 0;
                        return (
                          <div key={option.id} className="space-y-1">
                            <div className="flex items-center justify-between text-sm">
                              <span className="font-medium">{option.label}</span>
                              <span className="text-muted-foreground tabular-nums">{option.count} ({pct}%)</span>
                            </div>
                            <div className="h-3 rounded-full bg-muted overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all"
                                style={{
                                  width: `${pct}%`,
                                  backgroundColor: GAUGE_COLORS[i % GAUGE_COLORS.length],
                                }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{poll.totalVoters} voter{poll.totalVoters !== 1 ? "s" : ""}</span>
                      <span>
                        {new Date(poll.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                        {poll.expiresAt && !poll.closed && !isExpired && (
                          <> &middot; expires {new Date(poll.expiresAt).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</>
                        )}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Event List */}
      <Card className="rounded-lg">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">
            Event List ({events.length})
          </CardTitle>
          <Button size="sm" asChild>
            <Link to="/events/create">Create Event</Link>
          </Button>
        </CardHeader>
        <CardContent>
          {allEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No events yet. Create your first event to get started.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-3 pr-4 font-medium">Title</th>
                    <th className="pb-3 pr-4 font-medium">Category</th>
                    <th className="pb-3 pr-4 font-medium">Event Date</th>
                    <th className="pb-3 font-medium">Created</th>
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
                        <td className="py-3 pr-4">
                          <Link
                            to="/events/$eventId"
                            params={{ eventId: event.id }}
                            className="font-medium hover:underline hover:text-primary"
                          >
                            {event.title}
                          </Link>
                        </td>
                        <td className="py-3 pr-4">
                          {event.categoryId && (
                            <Badge variant="secondary" className="text-xs">
                              {categoryMap.get(event.categoryId) ?? event.categoryId}
                            </Badge>
                          )}
                        </td>
                        <td className="py-3 pr-4 whitespace-nowrap">
                          {dateStr} {timeStr}
                        </td>
                        <td className="py-3 whitespace-nowrap">
                          {createdStr} {createdTimeStr}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Places */}
      <PlacesCard groupId={data.group.id} places={data.places} />

      {/* About */}
      {group.summary && (
        <Card className="rounded-lg">
          <CardHeader>
            <CardTitle className="text-base">About</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
              {group.summary}
            </p>
            {group.website && (
              <a
                href={group.website}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-4">
                  <path fillRule="evenodd" d="M4.25 5.5a.75.75 0 0 0-.75.75v8.5c0 .414.336.75.75.75h8.5a.75.75 0 0 0 .75-.75v-4a.75.75 0 0 1 1.5 0v4A2.25 2.25 0 0 1 12.75 17h-8.5A2.25 2.25 0 0 1 2 14.75v-8.5A2.25 2.25 0 0 1 4.25 4h5a.75.75 0 0 1 0 1.5h-5Zm4.943.25a.75.75 0 0 1 0-1.5h5.057a.75.75 0 0 1 .75.75v5.057a.75.75 0 0 1-1.5 0V6.56l-5.22 5.22a.75.75 0 0 1-1.06-1.06l5.22-5.22H9.193Z" clipRule="evenodd" />
                </svg>
                {group.website}
              </a>
            )}
            {group.categories && (group.categories as string[]).length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {(group.categories as string[]).map((catId) => (
                  <Badge key={catId} variant="secondary">
                    {categoryMap.get(catId) ?? catId}
                  </Badge>
                ))}
              </div>
            )}
            {languageLabel(group.language) && (
              <p className="text-sm text-muted-foreground">
                Default language: {languageLabel(group.language)}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Members */}
      <Card className="rounded-lg">
        <CardHeader>
          <CardTitle className="text-base">Members ({members.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {owners.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                Owners
              </p>
              <ul className="space-y-1.5">
                {owners.map((m) => (
                  <MemberRow key={m.handle} member={m} />
                ))}
              </ul>
            </div>
          )}
          {moderators.length > 0 && (
            <>
              <Separator />
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                  Moderators
                </p>
                <ul className="space-y-1.5">
                  {moderators.map((m) => (
                    <MemberRow key={m.handle} member={m} />
                  ))}
                </ul>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Followers */}
      <Card className="rounded-lg">
        <CardHeader>
          <CardTitle className="text-base">
            Followers ({followers.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {followers.length === 0 ? (
            <p className="text-sm text-muted-foreground">No followers yet.</p>
          ) : (
            <ul className="space-y-1.5">
              {followers.map((f) => (
                <FollowerRow key={f.actorUrl} follower={f} />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <Card className="rounded-lg">
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <CardTitle className="text-base">Recent Activity</CardTitle>
            <div className="flex gap-1">
              {(["all", "reply", "reactions", "reposts"] as const).map((f) => (
                <Button
                  key={f}
                  variant={activityFilter === f ? "default" : "outline"}
                  size="sm"
                  className="text-xs h-7 px-2.5"
                  onClick={() => setActivityFilter(f)}
                >
                  {f === "all" ? "All" : f === "reply" ? "Replies" : f === "reactions" ? "Reactions" : "Reposts"}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredActivity.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No fediverse engagement yet.
            </p>
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

      {/* Post Note Dialog */}
      <Dialog open={noteDialogOpen} onOpenChange={setNoteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Post a Note</DialogTitle>
            <DialogDescription>
              Post an announcement from {group.name ?? `@${handle}`}. This will be delivered to all followers.
            </DialogDescription>
          </DialogHeader>

          {noteError && (
            <Alert variant="destructive">
              <AlertDescription>{noteError}</AlertDescription>
            </Alert>
          )}

          <MarkdownEditor
            value={noteContent}
            onChange={setNoteContent}
            placeholder="What's happening?"
            rows={4}
          />

          <DialogFooter>
            <Button variant="outline" onClick={() => setNoteDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={submitNote}
              disabled={noteSubmitting || !noteContent.trim()}
            >
              {noteSubmitting ? "Posting..." : "Post"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Poll Dialog */}
      <Dialog open={pollDialogOpen} onOpenChange={setPollDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create a Poll</DialogTitle>
            <DialogDescription>
              Create a poll for {group.name ?? `@${handle}`}. It will be delivered to all followers.
            </DialogDescription>
          </DialogHeader>

          {pollError && (
            <Alert variant="destructive">
              <AlertDescription>{pollError}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="poll-question">Question</Label>
              <Input
                id="poll-question"
                value={pollQuestion}
                onChange={(e) => setPollQuestion(e.target.value)}
                placeholder="What would you like to ask?"
              />
            </div>

            <div className="space-y-2">
              <Label>Type</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={pollType === "single" ? "default" : "outline"}
                  onClick={() => setPollType("single")}
                >
                  Single choice
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={pollType === "multiple" ? "default" : "outline"}
                  onClick={() => setPollType("multiple")}
                >
                  Multiple choice
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Options</Label>
              {pollOptions.map((opt, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    value={opt}
                    onChange={(e) => {
                      const next = [...pollOptions];
                      next[i] = e.target.value;
                      setPollOptions(next);
                    }}
                    placeholder={`Option ${i + 1}`}
                  />
                  {pollOptions.length > 2 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setPollOptions(pollOptions.filter((_, j) => j !== i))}
                    >
                      &times;
                    </Button>
                  )}
                </div>
              ))}
              {pollOptions.length < 20 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setPollOptions([...pollOptions, ""])}
                >
                  + Add option
                </Button>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="poll-expires">Expires in (hours, optional)</Label>
              <Input
                id="poll-expires"
                type="number"
                min="1"
                value={pollExpiresIn}
                onChange={(e) => setPollExpiresIn(e.target.value)}
                placeholder="e.g. 24"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPollDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={submitPoll}
              disabled={pollSubmitting || !pollQuestion.trim() || pollOptions.filter((o) => o.trim()).length < 2}
            >
              {pollSubmitting ? "Creating..." : "Create Poll"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {noteSuccess && (
        <Alert className="border-green-300 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-200">
          <AlertDescription>Note posted successfully!</AlertDescription>
        </Alert>
      )}
    </div>
  );
}

function MemberRow({
  member,
}: {
  member: { handle: string; name: string | null; isLocal: boolean };
}) {
  return (
    <li className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-accent/50 transition-colors">
      <div className="size-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold shrink-0">
        {(member.name ?? member.handle).charAt(0).toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <span className="text-sm font-medium">{member.name ?? member.handle}</span>
        <span className="text-sm text-muted-foreground ml-1.5">@{member.handle}</span>
      </div>
      {!member.isLocal && (
        <Badge variant="secondary" className="text-xs shrink-0">fediverse</Badge>
      )}
    </li>
  );
}

type PlaceFormState = {
  name: string;
  categoryId: string;
  description: string;
  address: string;
  website: string;
};

function PlacesCard({
  groupId,
  places,
}: {
  groupId: string;
  places: GroupData["places"];
}) {
  const navigate = useNavigate();
  const [editingPlace, setEditingPlace] = useState<GroupData["places"][number] | null>(null);
  const [form, setForm] = useState<PlaceFormState>({ name: "", categoryId: "", description: "", address: "", website: "" });
  const [options, setOptions] = useState<PlaceCategoryOption[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openEdit = (place: GroupData["places"][number]) => {
    setEditingPlace(place);
    setError(null);
    setForm({
      name: place.name,
      categoryId: place.category?.slug ?? "",
      description: place.description ?? "",
      address: place.address ?? "",
      website: "",
    });
    // Fetch category options
    fetch("/api/place-categories")
      .then((r) => r.json())
      .then((data) => setOptions(data.options ?? []))
      .catch(() => {});
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPlace) return;
    setSaving(true);
    setError(null);

    const res = await fetch(`/api/groups/${groupId}/places/${editingPlace.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name || undefined,
        categoryId: form.categoryId || null,
        description: form.description || undefined,
        address: form.address || undefined,
        website: form.website || undefined,
      }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Failed to update place");
      setSaving(false);
      return;
    }

    setSaving(false);
    setEditingPlace(null);
    navigate({ to: "/places/$placeId", params: { placeId: editingPlace.id } });
  };

  return (
    <>
      <Card className="rounded-lg">
        <CardHeader>
          <CardTitle className="text-base">Places ({places.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {places.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No places assigned to this group yet.
            </p>
          ) : (
            <div className="space-y-1.5">
              {places.map((place) => (
                <div
                  key={place.id}
                  className="flex items-center gap-3 rounded-md p-2 hover:bg-accent/50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <Link
                      to="/places/$placeId"
                      params={{ placeId: place.id }}
                      className="text-sm font-medium hover:underline hover:text-primary"
                    >
                      {place.name}
                    </Link>
                    {place.address && (
                      <span className="text-xs text-muted-foreground ml-2">{place.address}</span>
                    )}
                    {place.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{place.description}</p>
                    )}
                  </div>
                  {place.category && (
                    <Badge variant="secondary" className="text-xs shrink-0">
                      {`${place.category.emoji ?? ""} ${place.category.label}`.trim()}
                    </Badge>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => openEdit(place)}>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-4">
                      <path d="m5.433 13.917 1.262-3.155A4 4 0 0 1 7.58 9.42l6.92-6.918a2.121 2.121 0 0 1 3 3l-6.92 6.918c-.383.383-.84.685-1.343.886l-3.154 1.262a.5.5 0 0 1-.65-.65Z" />
                      <path d="M3.5 5.75c0-.69.56-1.25 1.25-1.25H10A.75.75 0 0 0 10 3H4.75A2.75 2.75 0 0 0 2 5.75v9.5A2.75 2.75 0 0 0 4.75 18h9.5A2.75 2.75 0 0 0 17 15.25V10a.75.75 0 0 0-1.5 0v5.25c0 .69-.56 1.25-1.25 1.25h-9.5c-.69 0-1.25-.56-1.25-1.25v-9.5Z" />
                    </svg>
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={editingPlace != null} onOpenChange={(open) => !open && setEditingPlace(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Place</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="place-name">Name</Label>
              <Input
                id="place-name"
                value={form.name}
                onChange={(e) => setForm((c) => ({ ...c, name: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="place-category">Category</Label>
              <PlaceCategorySelect
                id="place-category"
                value={form.categoryId}
                onChange={(value) => setForm((c) => ({ ...c, categoryId: value }))}
                options={options}
                emptyLabel="Uncategorized"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="place-description">Description</Label>
              <Textarea
                id="place-description"
                value={form.description}
                onChange={(e) => setForm((c) => ({ ...c, description: e.target.value }))}
                rows={3}
                placeholder="About this place..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="place-address">Address</Label>
              <Input
                id="place-address"
                value={form.address}
                onChange={(e) => setForm((c) => ({ ...c, address: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="place-website">Website</Label>
              <Input
                id="place-website"
                value={form.website}
                onChange={(e) => setForm((c) => ({ ...c, website: e.target.value }))}
                placeholder="https://example.com"
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditingPlace(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

function FollowerRow({
  follower,
}: {
  follower: {
    handle: string;
    name: string | null;
    actorUrl: string;
    domain: string | null;
    isLocal: boolean;
  };
}) {
  const displayHandle = follower.handle.includes("@")
    ? `@${follower.handle}`
    : `@${follower.handle}@${follower.domain}`;

  return (
    <li className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-accent/50 transition-colors">
      <div className="size-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold shrink-0">
        {(follower.name ?? follower.handle).charAt(0).toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <span className="text-sm font-medium">
          {follower.name ?? follower.handle}
        </span>
        <span className="text-sm text-muted-foreground ml-1.5">
          {displayHandle}
        </span>
      </div>
      {!follower.isLocal && (
        <Badge variant="secondary" className="text-xs shrink-0">
          {follower.domain}
        </Badge>
      )}
    </li>
  );
}
