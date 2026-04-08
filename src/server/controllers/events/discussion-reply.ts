import { eq, and, or, ne } from "drizzle-orm";
import { db } from "~/server/db/client";
import {
  events,
  actors,
  groupMembers,
  posts,
} from "~/server/db/schema";
import { getSessionUser } from "~/server/auth";
import { getFederationContext } from "~/server/fediverse/federation";
import { Create, isActor, Mention, Note, PUBLIC_COLLECTION } from "@fedify/fedify";
import { Temporal } from "@js-temporal/polyfill";

export const POST = async ({ request }: { request: Request }) => {
  const user = await getSessionUser(request);
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as {
    content?: string;
    parentPostId?: string;
    eventId?: string;
    inquiryId?: string;
  };

  const { content, parentPostId, eventId, inquiryId } = body;
  if (!eventId || !inquiryId || !content?.trim()) {
    return Response.json(
      { error: "eventId, inquiryId, and content are required" },
      { status: 400 },
    );
  }

  // Get event + access check
  const [event] = await db
    .select({
      id: events.id,
      groupActorId: events.groupActorId,
    })
    .from(events)
    .where(eq(events.id, eventId))
    .limit(1);

  if (!event) {
    return Response.json({ error: "Event not found" }, { status: 404 });
  }
  if (!event.groupActorId) {
    return Response.json(
      { error: "Discussions are only available for group events" },
      { status: 400 },
    );
  }

  // Get the group actor handle (local actor used for signing AP deliveries)
  const [groupActor] = await db
    .select({ id: actors.id, handle: actors.handle })
    .from(actors)
    .where(and(eq(actors.id, event.groupActorId), eq(actors.isLocal, true)))
    .limit(1);

  if (!groupActor) {
    return Response.json(
      { error: "Group actor not found" },
      { status: 500 },
    );
  }

  // Find the user's actor within this group
  const [memberActor] = await db
    .select({
      role: groupMembers.role,
      actorId: actors.id,
      actorHandle: actors.handle,
    })
    .from(groupMembers)
    .innerJoin(actors, eq(groupMembers.memberActorId, actors.id))
    .where(
      and(
        eq(groupMembers.groupActorId, event.groupActorId),
        eq(actors.userId, user.id),
        eq(actors.type, "Person"),
      ),
    )
    .limit(1);

  if (!memberActor) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  // Verify inquiry root exists
  const [rootPost] = await db
    .select({
      id: posts.id,
      eventId: posts.eventId,
      visibility: posts.visibility,
    })
    .from(posts)
    .where(and(eq(posts.id, inquiryId), eq(posts.eventId, eventId)))
    .limit(1);

  if (!rootPost) {
    return Response.json({ error: "Inquiry not found" }, { status: 404 });
  }

  // Gather all distinct participant actors in this thread
  // Only exclude the group actor (sender) — the organizer's member actor is a valid recipient
  const participants = await db
    .selectDistinctOn([actors.id], {
      actorId: actors.id,
      actorHandle: actors.handle,
      actorDomain: actors.domain,
      actorUrl: actors.actorUrl,
      actorProfileUrl: actors.url,
      inboxUrl: actors.inboxUrl,
    })
    .from(posts)
    .innerJoin(actors, eq(posts.actorId, actors.id))
    .where(
      and(
        or(eq(posts.id, inquiryId), eq(posts.threadRootId, inquiryId)),
        ne(actors.id, groupActor.id),
      ),
    );

  // Determine parent post (specific message or inquiry root)
  const replyToPostId = parentPostId ?? inquiryId;

  // Look up the parent post's original AP URI (for remote posts)
  const [parentPost] = await db
    .select({ apUri: posts.apUri })
    .from(posts)
    .where(eq(posts.id, replyToPostId))
    .limit(1);

  // Build AP URI for the parent — use original remote URI if available
  const ctx = getFederationContext();
  const parentApUri = parentPost?.apUri
    ?? ctx.getObjectUri(Note, { noteId: replyToPostId }).href;

  // Reply is public by default, but respect private visibility from the root
  const rootVis = rootPost.visibility ?? "public";
  const replyVisibility = (rootVis === "followers_only" || rootVis === "direct")
    ? rootVis
    : "unlisted";

  // Insert reply post
  const now = new Date();
  const [replyPost] = await db
    .insert(posts)
    .values({
      actorId: groupActor.id,
      content: content.trim(),
      inReplyTo: parentApUri,
      inReplyToPostId: replyToPostId,
      threadRootId: inquiryId,
      eventId,
      visibility: replyVisibility as string,
      published: now,
    })
    .returning();

  // Update inquiry root's lastRepliedAt
  await db
    .update(posts)
    .set({ lastRepliedAt: now })
    .where(eq(posts.id, inquiryId));

  // Deliver via ActivityPub
  const noteUri = ctx.getObjectUri(Note, { noteId: replyPost.id });

  // Resolve all participants — all get Mention tags and delivery
  const mentions: Mention[] = [];
  const mentionLinks: { name: string; href: string }[] = [];
  const participantUris: URL[] = [];
  const participantRecipients: { id: URL; inboxId: URL }[] = [];

  for (const p of participants) {
    const mentionName = `@${p.actorHandle}`;

    let actorUri: URL;
    let profileUrl: string;
    let inboxUri: URL | null = null;
    try {
      const resolved = await ctx.lookupObject(p.actorUrl);
      if (resolved && isActor(resolved) && resolved.id) {
        actorUri = resolved.id;
        const resolvedUrl = resolved.url;
        profileUrl = (resolvedUrl instanceof URL ? resolvedUrl.href : null) ?? p.actorProfileUrl ?? p.actorUrl;
        inboxUri = resolved.inboxId ?? null;
      } else {
        actorUri = new URL(p.actorUrl);
        profileUrl = p.actorProfileUrl ?? p.actorUrl;
        inboxUri = p.inboxUrl ? new URL(p.inboxUrl) : null;
      }
    } catch {
      actorUri = new URL(p.actorUrl);
      profileUrl = p.actorProfileUrl ?? p.actorUrl;
      inboxUri = p.inboxUrl ? new URL(p.inboxUrl) : null;
    }

    mentions.push(new Mention({ href: actorUri, name: mentionName }));
    mentionLinks.push({ name: mentionName, href: profileUrl });
    participantUris.push(actorUri);

    if (inboxUri) {
      participantRecipients.push({ id: actorUri, inboxId: inboxUri });
    }
  }

  // Determine to/cc based on visibility
  // All participants in tos (mentioned), followers/public in ccs
  const followersUri = ctx.getFollowersUri(groupActor.handle);
  let tos: URL[];
  let ccs: URL[];

  if (replyVisibility === "direct") {
    tos = [...participantUris];
    ccs = [];
  } else if (replyVisibility === "followers_only") {
    tos = [...participantUris];
    ccs = [followersUri];
  } else {
    // unlisted
    tos = [...participantUris];
    ccs = [PUBLIC_COLLECTION, followersUri];
  }

  // Strip plain text @handle mentions from content (UI prefills them)
  // then prepend proper HTML mention links for AP delivery
  let cleanedContent = content.trim();
  for (const { name } of mentionLinks) {
    // Remove plain text @handle (with optional trailing space)
    cleanedContent = cleanedContent.replace(new RegExp(`${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s?`, "g"), "");
  }
  cleanedContent = cleanedContent.trim();

  const mentionHtml = mentionLinks
    .map(({ name, href }) => `<a href="${href}" class="u-url mention">${name}</a>`)
    .join(" ");
  const htmlContent = mentionHtml && cleanedContent
    ? `<p>${mentionHtml}</p><p>${cleanedContent}</p>`
    : mentionHtml
      ? `<p>${mentionHtml}</p>`
      : `<p>${cleanedContent}</p>`;

  const note = new Note({
    id: noteUri,
    attribution: ctx.getActorUri(groupActor.handle),
    replyTarget: new URL(parentApUri),
    content: htmlContent,
    published: Temporal.Instant.from(now.toISOString()),
    tos,
    ccs,
    tags: mentions,
  });

  const createActivity = new Create({
    id: new URL(`${noteUri.href}#activity`),
    actor: ctx.getActorUri(groupActor.handle),
    object: note,
    published: Temporal.Instant.from(now.toISOString()),
    tos,
    ccs,
  });

  // Send to followers (not for direct visibility)
  if (replyVisibility !== "direct") {
    await ctx.sendActivity(
      { identifier: groupActor.handle },
      "followers",
      createActivity,
      { immediate: true },
    );
  }

  // Deliver directly to each participant (they may not be followers)
  for (const recipient of participantRecipients) {
    await ctx.sendActivity(
      { identifier: groupActor.handle },
      recipient,
      createActivity,
      { immediate: true },
    );
  }

  return Response.json({ post: replyPost }, { status: 201 });
};
