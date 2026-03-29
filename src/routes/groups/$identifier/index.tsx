import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { zodValidator } from "@tanstack/zod-adapter";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "~/server/db/client";
import { actors } from "~/server/db/schema";
import { useEventCategoryMap } from "~/hooks/useEventCategories";
import { languageLabel } from "~/shared/languages";
import { resolveCategoryLabel } from "~/lib/place";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "~/components/ui/avatar";
import { RemoteFollowDialog } from "~/components/RemoteFollowDialog";
import { BadgeCheck } from "lucide-react";

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
      links: [
        {
          rel: "alternate",
          type: "application/rss+xml",
          title: `${loaderData.name ?? loaderData.handle} — RSS`,
          href: `/groups/@${loaderData.handle}/feed.xml`,
        },
      ],
    };
  },
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
    verified: boolean;
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
  places: {
    id: string;
    name: string;
    description: string | null;
    address: string | null;
    latitude: string | null;
    longitude: string | null;
    category: { slug: string; label: string | null; emoji: string | null } | null;
  }[];
  currentUserRole: string | null;
};

type FeedItem =
  | { type: "event"; date: Date; event: GroupData["events"][number] }
  | { type: "note"; date: Date; note: GroupData["posts"][number] };

function ProfilePage() {
  const { categoryMap } = useEventCategoryMap();
  const { identifier } = Route.useParams();
  const handle = identifier.replace(/^@/, "");

  const [data, setData] = useState<GroupData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/groups/by-handle/${encodeURIComponent(handle)}`)
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
    <div className="mx-auto max-w-2xl">
      {/* Header */}
      <div className="flex items-start gap-4 pb-5 border-b-2 border-foreground">
        <Avatar className="size-14 shrink-0">
          {group.avatarUrl && <AvatarImage src={group.avatarUrl} alt={group.name ?? handle} />}
          <AvatarFallback className="text-xl font-semibold bg-muted text-muted-foreground">
            {(group.name ?? handle).charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <h2 className="text-2xl font-extrabold tracking-tight truncate">
              {group.name ?? `@${handle}`}
            </h2>
            {group.verified && (
              <BadgeCheck className="size-5 text-foreground shrink-0" />
            )}
          </div>
          <p className="text-[13px] text-[#888]">@{handle}</p>

          {group.summary && (
            <p className="text-[14px] text-[#444] leading-relaxed mt-2 whitespace-pre-wrap">
              {group.summary}
            </p>
          )}

          {group.website && (
            <a
              href={group.website}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[13px] text-[#555] underline underline-offset-2 hover:text-foreground mt-1 inline-block"
            >
              {group.website}
            </a>
          )}

          {/* Stats */}
          <div className="flex items-center gap-4 text-[12px] text-[#888] mt-3">
            <span><strong className="text-[#333]">{group.followersCount}</strong> followers</span>
            <span><strong className="text-[#333]">{events.length}</strong> events</span>
            {languageLabel(group.language) && (
              <span>{languageLabel(group.language)}</span>
            )}
          </div>

          {/* Categories */}
          {group.categories && (group.categories as string[]).length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {(group.categories as string[]).map((catId) => (
                <Badge key={catId} variant="outline" className="text-[10px] uppercase tracking-wide font-semibold">
                  {categoryMap.get(catId) ?? catId}
                </Badge>
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-2 mt-4">
            <RemoteFollowDialog actorHandle={handle} />
            <Button variant="outline" size="sm" asChild>
              <Link to="/groups/$identifier/events" params={{ identifier }}>Events</Link>
            </Button>
            {currentUserRole && (
              <Button variant="outline" size="sm" asChild>
                <Link to="/groups/$identifier/dashboard" params={{ identifier }}>Dashboard</Link>
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Places */}
      {data.places && data.places.length > 0 && (
        <section className="mt-6">
          <h3 className="text-xs font-bold uppercase tracking-wide text-[#333] mb-3">Places</h3>
          <div className="divide-y divide-[#f0f0f0]">
            {data.places.map((place) => (
              <Link
                key={place.id}
                to="/places/$placeId"
                params={{ placeId: place.id }}
                className="flex items-center justify-between py-3 first:pt-0 hover:bg-[#fafafa] transition-colors group"
              >
                <div className="min-w-0">
                  <span className="text-[13px] font-semibold group-hover:underline">{place.name}</span>
                  {place.address && (
                    <p className="text-[12px] text-[#888]">{place.address}</p>
                  )}
                </div>
                {place.category && (
                  <span className="text-[11px] text-[#888] border border-[#e5e5e5] rounded px-1.5 py-0.5 shrink-0 ml-3">
                    {place.category.label ? resolveCategoryLabel(place.category as { label: string; labels?: Record<string, string> }) : place.category.slug}
                  </span>
                )}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Activity timeline */}
      <section className="mt-8">
        <h3 className="text-xs font-bold uppercase tracking-wide text-[#333] mb-4">Activity</h3>
        {feedItems.length === 0 ? (
          <p className="text-sm text-muted-foreground">No activity yet.</p>
        ) : (
          <div className="relative pl-5">
            {/* Vertical line */}
            <div className="absolute left-[3px] top-1 bottom-1 w-px bg-[#e5e5e5]" />

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
      </section>
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
  const { categoryMap } = useEventCategoryMap();
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

  return (
    <div className="relative">
      {/* Dot on the timeline */}
      <div className="absolute -left-5 top-1 w-[7px] h-[7px] bg-foreground" style={{ left: "-21px" }} />

      <div className="flex items-center gap-2 mb-2">
        <span className="text-[10px] font-bold uppercase tracking-wide text-[#555] border border-[#ddd] px-1 py-0">Event</span>
        <span className="text-[11px] text-[#999]">{postedAt}</span>
      </div>

      <Link
        to="/events/$eventId"
        params={{ eventId: event.id }}
        className="block border-l-[3px] border-l-foreground pl-3 py-2 hover:bg-[#fafafa] transition-colors group"
      >
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[#555]">
          {dateStr} · {timeStr}
        </p>
        <h4 className="text-[15px] font-bold tracking-tight mt-0.5 group-hover:underline">
          {event.title}
        </h4>
        {event.location && (
          <p className="text-[12px] text-[#888] mt-0.5">{event.location}</p>
        )}
        {event.categoryId && (
          <span className="text-[10px] text-[#888] border border-[#e5e5e5] rounded px-1 py-0 mt-1 inline-block">
            {categoryMap.get(event.categoryId) ?? event.categoryId}
          </span>
        )}
      </Link>
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
    <div className="relative">
      {/* Dot on the timeline */}
      <div className="absolute w-[7px] h-[7px] bg-[#ccc]" style={{ left: "-21px", top: "4px" }} />

      <div className="flex items-center gap-2 mb-2">
        <span className="text-[10px] font-bold uppercase tracking-wide text-[#888] border border-[#e5e5e5] px-1 py-0">Note</span>
        <span className="text-[11px] text-[#999]">{postedAt}</span>
      </div>

      <div className="border-l-[3px] border-l-[#ddd] pl-3 py-1">
        <div
          className="prose prose-sm max-w-none text-[14px] text-[#444] leading-relaxed"
          dangerouslySetInnerHTML={{ __html: note.content }}
        />
        <Link
          to="/notes/$noteId"
          params={{ noteId: note.id }}
          className="text-[11px] text-[#999] hover:text-foreground underline underline-offset-2 mt-2 inline-block"
        >
          Permalink
        </Link>
      </div>
    </div>
  );
}
