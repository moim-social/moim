import { Create, Mention, Note, PUBLIC_COLLECTION } from "@fedify/fedify";
import { Temporal } from "@js-temporal/polyfill";
import { and, eq, isNotNull } from "drizzle-orm";
import { db } from "~/server/db/client";
import {
  events,
  rsvps,
  actors,
  posts,
  eventNotices,
  userFediverseAccounts,
  groupMembers,
} from "~/server/db/schema";
import { getFederationContext } from "~/server/fediverse/federation";
import { getI18n } from "~/server/i18n";
import { ensurePersistedRemoteActor } from "~/server/fediverse/resolve";
import { createNoticeRecord } from "~/server/repositories/event-notices";
import { renderMarkdown } from "~/lib/markdown";

export type NoticeVisibility = "unlisted" | "direct";

export interface SendNoticeParams {
  eventId: string;
  content: string;
  userId: string;
  visibility: NoticeVisibility;
}

export interface SendNoticeResult {
  notice: typeof eventNotices.$inferSelect;
  post: typeof posts.$inferSelect;
}

export async function sendEventNotice(
  params: SendNoticeParams,
): Promise<SendNoticeResult> {
  const { eventId, content, userId, visibility } = params;

  // 1. Fetch event
  const [event] = await db
    .select({
      id: events.id,
      title: events.title,
      organizerId: events.organizerId,
      groupActorId: events.groupActorId,
    })
    .from(events)
    .where(eq(events.id, eventId))
    .limit(1);

  if (!event) throw new Error("Event not found");

  // 2. Authorization
  if (event.groupActorId) {
    const [membership] = await db
      .select({ role: groupMembers.role })
      .from(groupMembers)
      .innerJoin(actors, eq(groupMembers.memberActorId, actors.id))
      .where(
        and(
          eq(groupMembers.groupActorId, event.groupActorId),
          eq(actors.userId, userId),
          eq(actors.type, "Person"),
        ),
      )
      .limit(1);
    if (!membership) throw new Error("Forbidden");
  } else {
    if (event.organizerId !== userId) throw new Error("Forbidden");
  }

  // 3. Resolve sending actor (Group for group events, local Person for personal)
  let sendingActor;
  if (event.groupActorId) {
    [sendingActor] = await db
      .select()
      .from(actors)
      .where(and(eq(actors.id, event.groupActorId), eq(actors.isLocal, true)))
      .limit(1);
  } else {
    [sendingActor] = await db
      .select()
      .from(actors)
      .where(
        and(
          eq(actors.userId, userId),
          eq(actors.type, "Person"),
          eq(actors.isLocal, true),
        ),
      )
      .limit(1);
  }

  if (!sendingActor) throw new Error("No local actor found for sending");

  // 4. Store raw markdown in DB, build AP HTML separately
  const i18n = getI18n(sendingActor.language);
  const fedCtx = getFederationContext();
  const now = new Date();
  const [post] = await db
    .insert(posts)
    .values({
      actorId: sendingActor.id,
      eventId,
      content,
      visibility,
      published: now,
    })
    .returning();

  // Build HTML with header/footer for AP delivery only
  const bodyHtml = renderMarkdown(content);
  const eventUrl = new URL(`/events/${eventId}`, fedCtx.canonicalOrigin).href;
  const apHtmlContent = [
    `<p><strong>${i18n._("📢 Notice: {eventTitle}", { eventTitle: event.title })}</strong></p>`,
    bodyHtml,
    `<p><small>${i18n._("This is a no-reply notice. For details, visit the <a href=\"{eventUrl}\">event page</a>.", { eventUrl })}</small></p>`,
  ].join("\n");

  // 5. Resolve attendee recipients
  // First get all accepted attendees' primary fediverse handles
  const attendeeHandles = await db
    .select({
      fediverseHandle: userFediverseAccounts.fediverseHandle,
    })
    .from(rsvps)
    .innerJoin(
      userFediverseAccounts,
      and(
        eq(rsvps.userId, userFediverseAccounts.userId),
        eq(userFediverseAccounts.isPrimary, true),
      ),
    )
    .where(
      and(
        eq(rsvps.eventId, eventId),
        eq(rsvps.status, "accepted"),
        isNotNull(rsvps.userId),
      ),
    );

  // Ensure each attendee has a persisted remote actor (lazy resolution)
  const attendeeActors = (
    await Promise.all(
      attendeeHandles.map(async ({ fediverseHandle }) => {
        try {
          return await ensurePersistedRemoteActor(fediverseHandle);
        } catch {
          return null;
        }
      }),
    )
  ).filter(
    (a): a is NonNullable<typeof a> => a != null && !!a.inboxUrl,
  );

  // 6. Create notice metadata record
  const notice = await createNoticeRecord({
    eventId,
    postId: post.id,
    sentByUserId: userId,
  });

  // 7. Compose AP Note + Create activity
  const ctx = fedCtx;
  const senderHandle = sendingActor.handle;
  const noteUri = ctx.getObjectUri(Note, { noteId: post.id });
  const published = Temporal.Instant.from(now.toISOString());

  const attendeeUris = attendeeActors.map((a) => new URL(a.actorUrl));

  // Build to/cc based on visibility
  let tos: URL[];
  let ccs: URL[];

  if (visibility === "direct") {
    tos = attendeeUris;
    ccs = [];
  } else {
    tos = [ctx.getFollowersUri(senderHandle), ...attendeeUris];
    ccs = [PUBLIC_COLLECTION];
  }

  // Include Mention tags for small attendee lists (≤50)
  const mentions = attendeeActors.length <= 50
    ? attendeeActors.map((a) => new Mention({
        href: new URL(a.actorUrl),
        name: `@${a.handle}`,
      }))
    : [];

  const note = new Note({
    id: noteUri,
    attribution: ctx.getActorUri(senderHandle),
    content: apHtmlContent,
    published,
    tos,
    ccs,
    tags: mentions.length > 0 ? mentions : [],
  });

  const createActivity = new Create({
    id: new URL(`${noteUri.href}#activity`),
    actor: ctx.getActorUri(senderHandle),
    object: note,
    published,
    tos,
    ccs,
  });

  // 8. Send to followers (only for unlisted)
  if (visibility === "unlisted") {
    await ctx.sendActivity(
      { identifier: senderHandle },
      "followers",
      createActivity,
    );
  }

  // 9. Direct delivery to each attendee's inbox
  for (const attendee of attendeeActors) {
    await ctx.sendActivity(
      { identifier: senderHandle },
      {
        id: new URL(attendee.actorUrl),
        inboxId: new URL(attendee.inboxUrl!),
      },
      createActivity,
      { immediate: true },
    );
  }

  return { notice, post };
}
