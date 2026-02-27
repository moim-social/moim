import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { zodValidator } from "@tanstack/zod-adapter";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "~/server/db/client";
import { actors } from "~/server/db/schema";
import { CATEGORIES } from "~/shared/categories";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { RemoteFollowDialog } from "~/components/RemoteFollowDialog";

const getGroupMeta = createServerFn({ method: "GET" })
  .inputValidator(zodValidator(z.object({ handle: z.string() })))
  .handler(async ({ data }) => {
    const [group] = await db
      .select({ name: actors.name, summary: actors.summary, handle: actors.handle, domain: actors.domain })
      .from(actors)
      .where(and(eq(actors.handle, data.handle), eq(actors.type, "Group"), eq(actors.isLocal, true)))
      .limit(1);
    return group ?? null;
  });

export const Route = createFileRoute("/groups/$identifier/")({
  component: ProfilePage,
  loader: async ({ params }) => {
    const handle = params.identifier.startsWith("@")
      ? params.identifier.slice(1)
      : params.identifier;
    return getGroupMeta({ data: { handle } });
  },
  head: ({ loaderData }) => {
    if (!loaderData) return {};
    const fullHandle = `@${loaderData.handle}@${loaderData.domain}`;
    const displayName = loaderData.name
      ? `${loaderData.name} (${fullHandle})`
      : fullHandle;
    return {
      meta: [
        { title: `${displayName} — Moim` },
        { name: "description", content: loaderData.summary ?? "" },
        { property: "og:title", content: displayName },
        { property: "og:description", content: loaderData.summary ?? "" },
        { property: "og:type", content: "profile" },
        { property: "fediverse:creator", content: fullHandle },
      ],
    };
  },
});

const categoryMap = new Map<string, string>(
  CATEGORIES.map((c) => [c.id, c.label]),
);

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
  posts: {
    id: string;
    content: string;
    published: string;
  }[];
  currentUserRole: string | null;
};

type FeedItem =
  | { type: "event"; date: Date; event: GroupData["events"][number] }
  | { type: "note"; date: Date; note: GroupData["posts"][number] };

function ProfilePage() {
  const { identifier } = Route.useParams();
  const handle = identifier.replace(/^@/, "");

  const [data, setData] = useState<GroupData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/groups/detail?handle=${encodeURIComponent(handle)}`)
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [handle]);

  if (loading) {
    return <p className="text-muted-foreground">Loading...</p>;
  }

  if (!data) {
    return <p className="text-destructive">Group not found</p>;
  }

  const { group, events, posts, currentUserRole } = data;

  // Build combined feed sorted by date descending
  const feedItems: FeedItem[] = [
    ...events.map((e) => ({
      type: "event" as const,
      date: new Date(e.createdAt),
      event: e,
    })),
    ...posts.map((p) => ({
      type: "note" as const,
      date: new Date(p.published),
      note: p,
    })),
  ].sort((a, b) => b.date.getTime() - a.date.getTime());

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Header */}
      <Card>
        <CardHeader className="flex flex-row items-center gap-4">
          <div className="size-14 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xl font-semibold shrink-0">
            {(group.name ?? handle).charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 space-y-1">
            <div className="flex items-center gap-2">
              <CardTitle className="text-xl">
                {group.name ?? `@${handle}`}
              </CardTitle>
              <Badge variant="secondary">Group</Badge>
            </div>
            <p className="text-sm text-muted-foreground">@{handle}</p>
          </div>
          <div className="flex items-center gap-2">
            {currentUserRole && (
              <Button variant="outline" size="sm" asChild>
                <Link
                  to="/groups/$identifier/dashboard"
                  params={{ identifier }}
                >
                  Dashboard
                </Link>
              </Button>
            )}
            <RemoteFollowDialog actorHandle={handle} />
          </div>
        </CardHeader>
      </Card>

      {/* About */}
      {(group.summary || group.website || (group.categories && (group.categories as string[]).length > 0)) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">About</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {group.summary && (
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {group.summary}
              </p>
            )}
            {group.website && (
              <p className="text-sm">
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
              <div className="flex flex-wrap gap-1.5">
                {(group.categories as string[]).map((catId) => (
                  <Badge key={catId} variant="secondary">
                    {categoryMap.get(catId) ?? catId}
                  </Badge>
                ))}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              {group.followersCount} follower{group.followersCount !== 1 ? "s" : ""}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Feed */}
      {feedItems.length === 0 ? (
        <p className="text-sm text-muted-foreground">No activity yet.</p>
      ) : (
        <div className="space-y-4">
          {feedItems.map((item) =>
            item.type === "event" ? (
              <EventFeedItem key={`event-${item.event.id}`} event={item.event} groupName={group.name ?? handle} />
            ) : (
              <NoteFeedItem key={`note-${item.note.id}`} note={item.note} groupName={group.name ?? handle} />
            ),
          )}
        </div>
      )}
    </div>
  );
}

function formatRelativeDate(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function EventFeedItem({
  event,
  groupName,
}: {
  event: GroupData["events"][number];
  groupName: string;
}) {
  const start = new Date(event.startsAt);
  const dateStr = start.toLocaleDateString(undefined, {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
  const timeStr = start.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
  const postedAt = formatRelativeDate(new Date(event.createdAt));

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Meta bar */}
      <div className="px-4 py-2.5 bg-muted/40 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{groupName}</span>
          <span>&middot;</span>
          <span>{postedAt}</span>
        </div>
        <Badge variant="outline" className="text-[11px] px-1.5 py-0">Event</Badge>
      </div>

      {/* Content */}
      <div className="px-4 py-4 space-y-3">
        <Link
          to="/events/$eventId"
          params={{ eventId: event.id }}
          className="block group"
        >
          <h4 className="font-semibold group-hover:underline">{event.title}</h4>
        </Link>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <span>{dateStr} at {timeStr}</span>
          {event.location && (
            <span>{event.location}</span>
          )}
        </div>

        {event.description && (
          <p className="text-sm text-muted-foreground line-clamp-2">
            {event.description}
          </p>
        )}

        <div className="flex items-center gap-2 pt-1">
          <Badge variant="secondary">
            {categoryMap.get(event.categoryId) ?? event.categoryId}
          </Badge>
        </div>
      </div>
    </div>
  );
}

function NoteFeedItem({
  note,
  groupName,
}: {
  note: { id: string; content: string; published: string };
  groupName: string;
}) {
  const postedAt = formatRelativeDate(new Date(note.published));

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Meta bar */}
      <div className="px-4 py-2.5 bg-muted/40 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{groupName}</span>
          <span>&middot;</span>
          <span>{postedAt}</span>
        </div>
        <Badge variant="outline" className="text-[11px] px-1.5 py-0">Note</Badge>
      </div>

      {/* Content */}
      <div className="px-4 py-4">
        <div
          className="text-sm leading-relaxed [&>p]:mb-2 [&>p:last-child]:mb-0"
          dangerouslySetInnerHTML={{ __html: note.content }}
        />
        <div className="mt-3">
          <Link
            to="/notes/$noteId"
            params={{ noteId: note.id }}
            className="text-xs text-primary hover:underline"
          >
            Permalink
          </Link>
        </div>
      </div>
    </div>
  );
}
