import { eq, and, isNull, desc } from "drizzle-orm";
import { Feed } from "feed";
import { db } from "~/server/db/client";
import { actors, events, posts } from "~/server/db/schema";
import { env } from "~/server/env";

const FEED_LIMIT = 50;

export const GET = async ({
  request,
}: { request: Request }): Promise<Response> => {
  const url = new URL(request.url);
  const handle = url.searchParams.get("handle");

  if (!handle) {
    return new Response("handle is required", { status: 400 });
  }

  const [group] = await db
    .select({
      id: actors.id,
      handle: actors.handle,
      name: actors.name,
      summary: actors.summary,
      language: actors.language,
    })
    .from(actors)
    .where(and(eq(actors.handle, handle), eq(actors.type, "Group")))
    .limit(1);

  if (!group) {
    return new Response("Group not found", { status: 404 });
  }

  const baseUrl = env.baseUrl;
  const groupUrl = `${baseUrl}/groups/@${group.handle}`;
  const feedUrl = `${groupUrl}/feed.xml`;

  const groupEvents = await db
    .select({
      id: events.id,
      title: events.title,
      description: events.description,
      startsAt: events.startsAt,
      location: events.location,
      createdAt: events.createdAt,
    })
    .from(events)
    .where(eq(events.groupActorId, group.id))
    .orderBy(desc(events.createdAt))
    .limit(FEED_LIMIT);

  const groupPosts = await db
    .select({
      id: posts.id,
      content: posts.content,
      published: posts.published,
    })
    .from(posts)
    .where(and(eq(posts.actorId, group.id), isNull(posts.eventId)))
    .orderBy(desc(posts.published))
    .limit(FEED_LIMIT);

  type FeedEntry = { date: Date; addToFeed: (feed: Feed) => void };
  const items: FeedEntry[] = [];

  for (const e of groupEvents) {
    const date = new Date(e.createdAt);
    const descriptionParts = [
      e.description,
      e.startsAt
        ? `Date: ${new Date(e.startsAt).toISOString()}`
        : null,
      e.location ? `Location: ${e.location}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    items.push({
      date,
      addToFeed: (feed) => {
        feed.addItem({
          title: e.title,
          id: `${baseUrl}/events/${e.id}`,
          link: `${baseUrl}/events/${e.id}`,
          description: descriptionParts || undefined,
          date,
          category: [{ name: "Event" }],
        });
      },
    });
  }

  for (const p of groupPosts) {
    const date = new Date(p.published);
    const plainText = p.content.replace(/<[^>]*>/g, "").slice(0, 80) || "Note";

    items.push({
      date,
      addToFeed: (feed) => {
        feed.addItem({
          title: plainText,
          id: `${baseUrl}/notes/${p.id}`,
          link: `${baseUrl}/notes/${p.id}`,
          content: p.content,
          date,
          category: [{ name: "Note" }],
        });
      },
    });
  }

  items.sort((a, b) => b.date.getTime() - a.date.getTime());
  const topItems = items.slice(0, FEED_LIMIT);

  const displayName = group.name ?? `@${group.handle}`;

  const feed = new Feed({
    title: displayName,
    description: group.summary ?? `Activity from ${displayName}`,
    id: groupUrl,
    link: groupUrl,
    language: group.language ?? undefined,
    feedLinks: { rss2: feedUrl },
    updated: topItems.length > 0 ? topItems[0].date : new Date(),
    copyright: "",
  });

  for (const item of topItems) {
    item.addToFeed(feed);
  }

  return new Response(feed.rss2(), {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=900",
    },
  });
};
