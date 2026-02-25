import { Announce, Create, Mention, Note, PUBLIC_COLLECTION } from "@fedify/fedify";
import { Temporal } from "@js-temporal/polyfill";
import { and, eq } from "drizzle-orm";
import { db } from "~/server/db/client";
import { actors, posts } from "~/server/db/schema";
import { CATEGORIES } from "~/shared/categories";
import { getFederationContext } from "./federation";

/**
 * Get the feed actor handle for a category.
 */
export function categoryHandle(categoryId: string): string {
  return `feed_${categoryId}`;
}

/**
 * Ensure a Service actor exists for the given category.
 * Auto-provisions on first call (like ensureInstanceActor).
 */
export async function ensureCategoryActor(
  categoryId: string,
): Promise<typeof actors.$inferSelect> {
  const category = CATEGORIES.find((c) => c.id === categoryId);
  if (!category) throw new Error(`Unknown category: ${categoryId}`);

  const handle = categoryHandle(categoryId);
  const ctx = getFederationContext();

  const [existing] = await db
    .select()
    .from(actors)
    .where(and(eq(actors.handle, handle), eq(actors.isLocal, true)))
    .limit(1);
  if (existing) return existing;

  const [actor] = await db
    .insert(actors)
    .values({
      handle,
      type: "Service",
      actorUrl: ctx.getActorUri(handle).href,
      iri: ctx.getActorUri(handle).href,
      name: `${category.label} Events`,
      summary: `Event feed for the ${category.label} category on Moim.`,
      inboxUrl: ctx.getInboxUri(handle).href,
      outboxUrl: ctx.getOutboxUri(handle).href,
      sharedInboxUrl: ctx.getInboxUri().href,
      followersUrl: ctx.getFollowersUri(handle).href,
      followingUrl: ctx.getFollowingUri(handle).href,
      domain: new URL(ctx.canonicalOrigin).hostname,
      isLocal: true,
    })
    .onConflictDoNothing()
    .returning();

  // Handle race condition: if onConflictDoNothing returned nothing, re-fetch
  if (!actor) {
    const [refetched] = await db
      .select()
      .from(actors)
      .where(and(eq(actors.handle, handle), eq(actors.isLocal, true)))
      .limit(1);
    return refetched;
  }

  return actor;
}

/**
 * Post a Note about a new event from the Group actor,
 * then have the category Service actor Announce (boost) it.
 */
export async function announceEvent(
  categoryId: string,
  groupActorId: string,
  event: {
    id: string;
    title: string;
    description?: string | null;
    startsAt: Date;
    endsAt?: Date | null;
  },
  organizers: Array<{ handle: string; actorUrl: string }>,
): Promise<typeof posts.$inferSelect> {
  const categoryActor = await ensureCategoryActor(categoryId);
  const ctx = getFederationContext();

  // Look up group actor
  const [groupActor] = await db
    .select()
    .from(actors)
    .where(and(eq(actors.id, groupActorId), eq(actors.isLocal, true)))
    .limit(1);
  if (!groupActor) throw new Error(`Group actor not found: ${groupActorId}`);

  const groupHandle = groupActor.handle;

  // Build HTML content
  const startStr = event.startsAt.toISOString();
  const endStr = event.endsAt ? ` — ${event.endsAt.toISOString()}` : "";
  const eventUrl = new URL(`/events/${event.id}`, ctx.canonicalOrigin).href;
  const orgMentions = organizers
    .map(
      (o) =>
        `<a href="${o.actorUrl}" class="u-url mention">@${o.handle}</a>`,
    )
    .join(", ");

  const descHtml = event.description
    ? `<p>${event.description}</p>`
    : "";

  const content = [
    `<p><strong><a href="${eventUrl}">${event.title}</a></strong></p>`,
    descHtml,
    `<p>📅 ${startStr}${endStr}</p>`,
    organizers.length > 0
      ? `<p>Organized by: ${orgMentions}</p>`
      : "",
    `<p><a href="${eventUrl}">View event details</a></p>`,
  ]
    .filter(Boolean)
    .join("\n");

  // Build Mention tags for organizers
  const tags = organizers.map(
    (o) =>
      new Mention({
        href: new URL(o.actorUrl),
        name: `@${o.handle}`,
      }),
  );

  // Create post record attributed to the Group actor
  const now = new Date();
  const [post] = await db
    .insert(posts)
    .values({
      actorId: groupActor.id,
      content,
      published: now,
    })
    .returning();

  const noteUri = ctx.getObjectUri(Note, { noteId: post.id });
  const published = Temporal.Instant.from(now.toISOString());

  // Build Note attributed to Group actor
  const note = new Note({
    id: noteUri,
    attribution: ctx.getActorUri(groupHandle),
    content,
    url: new URL(`/notes/${post.id}`, ctx.canonicalOrigin),
    tags,
    published,
    to: PUBLIC_COLLECTION,
    ccs: [ctx.getFollowersUri(groupHandle)],
  });

  // 1. Group actor sends Create(Note) to its own followers
  await ctx.sendActivity(
    { identifier: groupHandle },
    "followers",
    new Create({
      id: new URL(`${noteUri.href}#activity`),
      actor: ctx.getActorUri(groupHandle),
      object: note,
      published,
      to: PUBLIC_COLLECTION,
      ccs: [ctx.getFollowersUri(groupHandle)],
    }),
  );

  // 2. Category Service actor Announces (boosts) the Note to its followers
  const categoryHandle = categoryActor.handle;
  await ctx.sendActivity(
    { identifier: categoryHandle },
    "followers",
    new Announce({
      id: new URL(`${noteUri.href}#announce`),
      actor: ctx.getActorUri(categoryHandle),
      object: noteUri,
      published,
      to: PUBLIC_COLLECTION,
      ccs: [ctx.getFollowersUri(categoryHandle)],
    }),
  );

  return post;
}
