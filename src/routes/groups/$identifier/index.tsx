import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { zodValidator } from "@tanstack/zod-adapter";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "~/server/db/client";
import { actors } from "~/server/db/schema";
import { CATEGORIES } from "~/shared/categories";
import { pickGradient } from "~/shared/gradients";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "~/components/ui/avatar";
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
    avatarUrl: string | null;
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
      <Card className="rounded-lg">
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <Avatar className="size-14 shrink-0">
              {group.avatarUrl && <AvatarImage src={group.avatarUrl} alt={group.name ?? handle} />}
              <AvatarFallback className="text-xl font-semibold bg-primary/10 text-primary">
                {(group.name ?? handle).charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-semibold tracking-tight truncate">
                  {group.name ?? `@${handle}`}
                </h2>
                <Badge variant="secondary" className="shrink-0">Group</Badge>
              </div>
              <p className="text-sm text-muted-foreground">@{handle}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
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
          </div>
        </CardContent>
      </Card>

      {/* About */}
      {(group.summary || group.website || (group.categories && (group.categories as string[]).length > 0)) && (
        <Card className="rounded-lg">
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
            <div className="flex items-center gap-4 text-xs text-muted-foreground pt-1">
              <span>{group.followersCount} follower{group.followersCount !== 1 ? "s" : ""}</span>
              <span>{events.length} event{events.length !== 1 ? "s" : ""}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Timeline */}
      <div>
        <h3 className="text-sm font-medium text-muted-foreground mb-4">Activity</h3>
        {feedItems.length === 0 ? (
          <p className="text-sm text-muted-foreground pl-8">No activity yet.</p>
        ) : (
          <div className="relative">
            {/* Vertical line */}
            <div className="absolute left-[7px] top-2 bottom-2 w-px bg-border" />

            <div className="space-y-6">
              {feedItems.map((item) =>
                item.type === "event" ? (
                  <TimelineEvent key={`event-${item.event.id}`} event={item.event} />
                ) : (
                  <TimelineNote key={`note-${item.note.id}`} note={item.note} />
                ),
              )}
            </div>
          </div>
        )}
      </div>
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

function TimelineEvent({
  event,
}: {
  event: GroupData["events"][number];
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
  const postedAt = formatRelativeDate(new Date(event.createdAt));
  const [gradFrom] = pickGradient(event.categoryId || event.id);

  return (
    <div className="relative flex gap-4 pl-0">
      {/* Dot */}
      <div
        className="relative z-10 mt-1.5 size-[15px] rounded-full border-2 border-background shrink-0"
        style={{ backgroundColor: gradFrom }}
      />

      {/* Content */}
      <div className="flex-1 min-w-0 pb-1">
        <div className="flex items-center gap-2 mb-1">
          <Badge variant="outline" className="text-xs px-1.5 py-0">Event</Badge>
          {event.categoryId && (
            <Badge variant="secondary" className="text-xs">
              {categoryMap.get(event.categoryId) ?? event.categoryId}
            </Badge>
          )}
          <span className="text-xs text-muted-foreground">{postedAt}</span>
        </div>

        <div className="rounded-lg border p-4 space-y-2">
          <Link
            to="/events/$eventId"
            params={{ eventId: event.id }}
            className="group"
          >
            <h4 className="font-semibold group-hover:text-primary transition-colors">
              {event.title}
            </h4>
          </Link>

          <div className="space-y-0.5 text-sm text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-3.5 shrink-0">
                <path fillRule="evenodd" d="M5.75 2a.75.75 0 0 1 .75.75V4h7V2.75a.75.75 0 0 1 1.5 0V4h.25A2.75 2.75 0 0 1 18 6.75v8.5A2.75 2.75 0 0 1 15.25 18H4.75A2.75 2.75 0 0 1 2 15.25v-8.5A2.75 2.75 0 0 1 4.75 4H5V2.75A.75.75 0 0 1 5.75 2Zm-1 5.5c-.69 0-1.25.56-1.25 1.25v6.5c0 .69.56 1.25 1.25 1.25h10.5c.69 0 1.25-.56 1.25-1.25v-6.5c0-.69-.56-1.25-1.25-1.25H4.75Z" clipRule="evenodd" />
              </svg>
              <span>{dateStr} · {timeStr}</span>
            </div>
            {event.location && (
              <div className="flex items-center gap-1.5">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-3.5 shrink-0">
                  <path fillRule="evenodd" d="m9.69 18.933.003.001C9.89 19.02 10 19 10 19s.11.02.308-.066l.002-.001.006-.003.018-.008a5.741 5.741 0 0 0 .281-.14c.186-.096.446-.24.757-.433.62-.384 1.445-.966 2.274-1.765C15.302 14.988 17 12.493 17 9A7 7 0 1 0 3 9c0 3.492 1.698 5.988 3.355 7.584a13.731 13.731 0 0 0 2.273 1.765 11.842 11.842 0 0 0 .976.544l.062.029.018.008.006.003ZM10 11.25a2.25 2.25 0 1 0 0-4.5 2.25 2.25 0 0 0 0 4.5Z" clipRule="evenodd" />
                </svg>
                <span>{event.location}</span>
              </div>
            )}
          </div>

          {event.description && (
            <p className="text-sm text-muted-foreground line-clamp-2">
              {event.description}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function TimelineNote({
  note,
}: {
  note: { id: string; content: string; published: string };
}) {
  const postedAt = formatRelativeDate(new Date(note.published));

  return (
    <div className="relative flex gap-4 pl-0">
      {/* Dot */}
      <div className="relative z-10 mt-1.5 size-[15px] rounded-full border-2 border-background bg-muted-foreground/40 shrink-0" />

      {/* Content */}
      <div className="flex-1 min-w-0 pb-1">
        <div className="flex items-center gap-2 mb-1">
          <Badge variant="outline" className="text-xs px-1.5 py-0">Note</Badge>
          <span className="text-xs text-muted-foreground">{postedAt}</span>
        </div>

        <div className="rounded-lg border p-4 space-y-2">
          <div
            className="text-sm leading-relaxed [&>p]:mb-2 [&>p:last-child]:mb-0"
            dangerouslySetInnerHTML={{ __html: note.content }}
          />

          <Link
            to="/notes/$noteId"
            params={{ noteId: note.id }}
            className="text-xs text-primary hover:underline inline-block"
          >
            Permalink
          </Link>
        </div>
      </div>
    </div>
  );
}
