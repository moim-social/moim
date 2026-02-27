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
 * Post a Note about a new event from the host actor (Group or Person),
 * then optionally have the category Service actor Announce (boost) it.
 * For personal events, pass { skipAnnounce: true } to skip the Announce step.
 */
export async function announceEvent(
  categoryId: string | null | undefined,
  hostActorId: string,
  event: {
    id: string;
    title: string;
    description?: string | null;
    startsAt: Date;
    endsAt?: Date | null;
  },
  organizers: Array<{ handle: string; actorUrl: string }>,
  options?: {
    skipAnnounce?: boolean;
    creatorMention?: { handle: string; actorUrl: string; inboxUrl: string };
  },
): Promise<typeof posts.$inferSelect> {
  const ctx = getFederationContext();

  // Look up host actor (Group or Person)
  const [hostActor] = await db
    .select()
    .from(actors)
    .where(and(eq(actors.id, hostActorId), eq(actors.isLocal, true)))
    .limit(1);
  if (!hostActor) throw new Error(`Host actor not found: ${hostActorId}`);

  const hostHandle = hostActor.handle;

  // Build HTML content
  const startStr = event.startsAt.toISOString();
  const endStr = event.endsAt ? ` — ${event.endsAt.toISOString()}` : "";
  const eventUrl = new URL(`/events/${event.id}`, ctx.canonicalOrigin).href;
  const descHtml = event.description
    ? `<p>${event.description}</p>`
    : "";

  let content: string;
  const tags: Mention[] = [];

  if (options?.creatorMention) {
    // Personal event: casual format with visible creator mention
    const cm = options.creatorMention;
    content = [
      `<p><a href="${cm.actorUrl}" class="u-url mention">@${cm.handle}</a> is hosting an event!</p>`,
      `<p><strong><a href="${eventUrl}">${event.title}</a></strong></p>`,
      descHtml,
      `<p>📅 ${startStr}${endStr}</p>`,
      `<p><a href="${eventUrl}">RSVP here</a></p>`,
    ]
      .filter(Boolean)
      .join("\n");

    tags.push(
      new Mention({
        href: new URL(cm.actorUrl),
        name: `@${cm.handle}`,
      }),
    );
  } else {
    // Group event: structured format with organizer list
    const orgMentions = organizers
      .map(
        (o) =>
          `<a href="${o.actorUrl}" class="u-url mention">@${o.handle}</a>`,
      )
      .join(", ");

    content = [
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
  }

  // Add Mention tags for organizers
  for (const o of organizers) {
    tags.push(
      new Mention({
        href: new URL(o.actorUrl),
        name: `@${o.handle}`,
      }),
    );
  }

  // Create post record attributed to the host actor
  const now = new Date();
  const [post] = await db
    .insert(posts)
    .values({
      actorId: hostActor.id,
      content,
      published: now,
    })
    .returning();

  const noteUri = ctx.getObjectUri(Note, { noteId: post.id });
  const published = Temporal.Instant.from(now.toISOString());

  // Build Note attributed to host actor
  const note = new Note({
    id: noteUri,
    attribution: ctx.getActorUri(hostHandle),
    content,
    url: new URL(`/notes/${post.id}`, ctx.canonicalOrigin),
    tags,
    published,
    to: PUBLIC_COLLECTION,
    ccs: [PUBLIC_COLLECTION, ctx.getFollowersUri(hostHandle)],
  });

  const createActivity = new Create({
    id: new URL(`${noteUri.href}#activity`),
    actor: ctx.getActorUri(hostHandle),
    object: note,
    published,
    to: PUBLIC_COLLECTION,
    ccs: [PUBLIC_COLLECTION, ctx.getFollowersUri(hostHandle)],
  });

  // 1. Host actor sends Create(Note) to its own followers
  await ctx.sendActivity(
    { identifier: hostHandle },
    "followers",
    createActivity,
  );

  // 2. Deliver directly to mentioned creator (so they get a notification)
  if (options?.creatorMention) {
    await ctx.sendActivity(
      { identifier: hostHandle },
      {
        id: new URL(options.creatorMention.actorUrl),
        inboxId: new URL(options.creatorMention.inboxUrl),
      },
      createActivity,
    );
  }

  // 2. Category Service actor Announces (boosts) the Note to its followers
  //    Skipped for personal events or when no category is set
  if (!options?.skipAnnounce && categoryId) {
    const categoryActor = await ensureCategoryActor(categoryId!);
    const catHandle = categoryActor.handle;
    await ctx.sendActivity(
      { identifier: catHandle },
      "followers",
      new Announce({
        id: new URL(`${noteUri.href}#announce`),
        actor: ctx.getActorUri(catHandle),
        object: noteUri,
        published,
        to: PUBLIC_COLLECTION,
        ccs: [ctx.getFollowersUri(catHandle)],
      }),
    );
  }

  return post;
}
