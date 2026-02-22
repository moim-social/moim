import { Create, Note } from "@fedify/fedify";
import { Temporal } from "@js-temporal/polyfill";
import { and, eq } from "drizzle-orm";
import { db } from "~/server/db/client";
import { actors, groupMembers, posts, users } from "~/server/db/schema";
import { getFederationContext } from "./federation";

/**
 * Create a Group actor for an event community/series.
 *
 * @param handle - snake_case handle (e.g., "tokyo_meetup")
 * @param name - Display name (e.g., "Tokyo Meetup")
 * @param summary - Description of the group
 * @param hostUserId - UUID of the user who manages this group
 * @returns The created actor record
 */
export async function createGroupActor(
  handle: string,
  name: string,
  summary: string,
  hostUserId: string,
): Promise<typeof actors.$inferSelect> {
  const ctx = getFederationContext();

  // Create the Group actor
  const [actor] = await db
    .insert(actors)
    .values({
      handle,
      type: "Group",
      actorUrl: ctx.getActorUri(handle).href,
      iri: ctx.getActorUri(handle).href,
      url: new URL(`/@${handle}`, ctx.canonicalOrigin).href,
      name,
      summary,
      inboxUrl: ctx.getInboxUri(handle).href,
      outboxUrl: ctx.getOutboxUri(handle).href,
      sharedInboxUrl: ctx.getInboxUri().href,
      followersUrl: ctx.getFollowersUri(handle).href,
      followingUrl: ctx.getFollowingUri(handle).href,
      domain: new URL(ctx.canonicalOrigin).hostname,
      isLocal: true,
    })
    .returning();

  // Ensure the host user has a Person actor
  let [hostActor] = await db
    .select()
    .from(actors)
    .where(and(eq(actors.userId, hostUserId), eq(actors.isLocal, true)))
    .limit(1);

  if (!hostActor) {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, hostUserId))
      .limit(1);
    if (!user) throw new Error(`User not found: ${hostUserId}`);

    const [inserted] = await db
      .insert(actors)
      .values({
        handle: user.handle,
        type: "Person",
        actorUrl: ctx.getActorUri(user.handle).href,
        iri: ctx.getActorUri(user.handle).href,
        url: new URL(`/@${user.handle}`, ctx.canonicalOrigin).href,
        name: user.displayName,
        summary: user.summary ?? "",
        inboxUrl: ctx.getInboxUri(user.handle).href,
        outboxUrl: ctx.getOutboxUri(user.handle).href,
        sharedInboxUrl: ctx.getInboxUri().href,
        followersUrl: ctx.getFollowersUri(user.handle).href,
        followingUrl: ctx.getFollowingUri(user.handle).href,
        domain: new URL(ctx.canonicalOrigin).hostname,
        isLocal: true,
        userId: user.id,
      })
      .returning();
    hostActor = inserted;
  }

  // Link host as group member
  await db.insert(groupMembers).values({
    groupActorId: actor.id,
    memberActorId: hostActor.id,
    role: "host",
  });

  return actor;
}

/**
 * Create a Note and deliver it to all followers of the actor.
 *
 * @param actorHandle - Handle of the actor (typically a Group actor)
 * @param content - HTML content of the Note
 * @returns The created post record
 */
export async function createAndDeliverNote(
  actorHandle: string,
  content: string,
): Promise<typeof posts.$inferSelect> {
  const ctx = getFederationContext();

  // Find the actor
  const [actor] = await db
    .select()
    .from(actors)
    .where(and(eq(actors.handle, actorHandle), eq(actors.isLocal, true)))
    .limit(1);
  if (!actor) throw new Error(`Local actor not found: ${actorHandle}`);

  // Create post record
  const now = new Date();
  const [post] = await db
    .insert(posts)
    .values({
      actorId: actor.id,
      content,
      published: now,
    })
    .returning();

  // Build Note
  const noteUri = ctx.getObjectUri(Note, {
    identifier: actorHandle,
    noteId: post.id,
  });
  const note = new Note({
    id: noteUri,
    attribution: ctx.getActorUri(actorHandle),
    content,
    published: Temporal.Instant.from(now.toISOString()),
    to: new URL("https://www.w3.org/ns/activitystreams#Public"),
    ccs: [ctx.getFollowersUri(actorHandle)],
  });

  // Deliver Create(Note) to followers
  await ctx.sendActivity(
    { identifier: actorHandle },
    "followers",
    new Create({
      id: new URL(`${noteUri.href}#activity`),
      actor: ctx.getActorUri(actorHandle),
      object: note,
      published: Temporal.Instant.from(now.toISOString()),
      to: new URL("https://www.w3.org/ns/activitystreams#Public"),
      ccs: [ctx.getFollowersUri(actorHandle)],
    }),
  );

  return post;
}
