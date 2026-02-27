import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CATEGORIES } from "~/shared/categories";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
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
import { Alert, AlertDescription } from "~/components/ui/alert";

export const Route = createFileRoute("/groups/$identifier/dashboard")({
  component: GroupDashboard,
});

const categoryMap = new Map<string, string>(CATEGORIES.map((c) => [c.id, c.label]));

type GroupData = {
  group: {
    id: string;
    handle: string;
    name: string | null;
    summary: string | null;
    website: string | null;
    categories: string[] | null;
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
  currentUserRole: string | null;
};

function GroupDashboard() {
  const { identifier } = Route.useParams();
  const navigate = useNavigate();
  const handle = identifier.replace(/^@/, "");

  const [data, setData] = useState<GroupData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Post Note dialog
  const [noteDialogOpen, setNoteDialogOpen] = useState(false);
  const [noteContent, setNoteContent] = useState("");
  const [noteSubmitting, setNoteSubmitting] = useState(false);
  const [noteError, setNoteError] = useState("");
  const [noteSuccess, setNoteSuccess] = useState(false);

  useEffect(() => {
    fetch(`/groups/detail?handle=${encodeURIComponent(handle)}`)
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
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [handle, identifier, navigate]);

  async function submitNote() {
    setNoteSubmitting(true);
    setNoteError("");
    setNoteSuccess(false);
    try {
      const res = await fetch("/groups/create-note", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupHandle: handle, content: noteContent }),
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
      const refreshRes = await fetch(`/groups/detail?handle=${encodeURIComponent(handle)}`);
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

  const { group, members, followers, events } = data;
  const hosts = members.filter((m) => m.role === "host");
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
          <div className="size-14 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xl font-semibold shrink-0">
            {(group.name ?? handle).charAt(0).toUpperCase()}
          </div>
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
          <Button variant="outline" size="sm" onClick={() => { setNoteDialogOpen(true); setNoteSuccess(false); setNoteError(""); }}>
            Post Note
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
          </CardContent>
        </Card>
      )}

      {/* Members */}
      <Card className="rounded-lg">
        <CardHeader>
          <CardTitle className="text-base">Members ({members.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {hosts.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                Hosts
              </p>
              <ul className="space-y-1.5">
                {hosts.map((m) => (
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

          <Textarea
            placeholder="What's happening?"
            value={noteContent}
            onChange={(e) => setNoteContent(e.target.value)}
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
