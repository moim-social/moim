import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CATEGORIES } from "~/shared/categories";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Separator } from "~/components/ui/separator";

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

  const upcomingEvents = events.filter(
    (e) => new Date(e.startsAt) >= new Date(),
  );
  const pastEvents = events.filter(
    (e) => new Date(e.startsAt) < new Date(),
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="size-14 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xl font-semibold shrink-0">
            {(group.name ?? handle).charAt(0).toUpperCase()}
          </div>
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">
              {group.name ?? `@${handle}`}
            </h2>
            <p className="text-sm text-muted-foreground">@{handle}</p>
          </div>
          <Badge variant="outline">
            {data.currentUserRole}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link
              to="/groups/$identifier"
              params={{ identifier }}
            >
              Public Page
            </Link>
          </Button>
          <Button size="sm" asChild>
            <Link to="/events/create">Create Event</Link>
          </Button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Followers</CardDescription>
            <CardTitle className="text-2xl">{group.followersCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Members</CardDescription>
            <CardTitle className="text-2xl">{members.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Events</CardDescription>
            <CardTitle className="text-2xl">{events.length}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* About */}
      {group.summary && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">About</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
              {group.summary}
            </p>
            {group.website && (
              <p className="text-sm mt-2">
                <a
                  href={group.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  {group.website}
                </a>
              </p>
            )}
            {group.categories && (group.categories as string[]).length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3">
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
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Members</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {hosts.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                Hosts
              </p>
              <ul className="space-y-1">
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
                <ul className="space-y-1">
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
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Followers ({followers.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {followers.length === 0 ? (
            <p className="text-sm text-muted-foreground">No followers yet.</p>
          ) : (
            <ul className="space-y-1">
              {followers.map((f) => (
                <FollowerRow key={f.actorUrl} follower={f} />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Upcoming Events */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Upcoming Events</CardTitle>
          <Button size="sm" asChild>
            <Link to="/events/create">Create Event</Link>
          </Button>
        </CardHeader>
        <CardContent>
          {upcomingEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground">No upcoming events.</p>
          ) : (
            <ul className="space-y-3">
              {upcomingEvents.map((event) => (
                <EventRow key={event.id} event={event} />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Past Events */}
      {pastEvents.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Past Events</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {pastEvents.map((event) => (
                <EventRow key={event.id} event={event} />
              ))}
            </ul>
          </CardContent>
        </Card>
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
    <li className="flex items-center gap-2 px-3 py-2 rounded-md border">
      <div className="size-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold shrink-0">
        {(member.name ?? member.handle).charAt(0).toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <span className="text-sm font-medium">{member.name ?? member.handle}</span>
        <span className="text-sm text-muted-foreground ml-1.5">@{member.handle}</span>
      </div>
      {!member.isLocal && (
        <Badge variant="secondary" className="text-xs">fediverse</Badge>
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
    <li className="flex items-center gap-2 px-3 py-2 rounded-md border">
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
        <Badge variant="secondary" className="text-xs">
          {follower.domain}
        </Badge>
      )}
    </li>
  );
}

function EventRow({
  event,
}: {
  event: {
    id: string;
    title: string;
    categoryId: string;
    startsAt: string;
    endsAt: string | null;
  };
}) {
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

  return (
    <li className="flex items-center justify-between px-3 py-2 rounded-md border">
      <div>
        <p className="text-sm font-medium">{event.title}</p>
        <p className="text-xs text-muted-foreground">
          {dateStr} at {timeStr}
        </p>
      </div>
      <Badge variant="secondary">
        {categoryMap.get(event.categoryId) ?? event.categoryId}
      </Badge>
    </li>
  );
}
