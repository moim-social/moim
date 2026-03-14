import { Create, Image, LanguageString, Mention, Note, Place, PUBLIC_COLLECTION } from "@fedify/fedify";
import { Temporal } from "@js-temporal/polyfill";
import { and, eq } from "drizzle-orm";
import { db } from "~/server/db/client";
import { actors, places as placesTable, posts, userFediverseAccounts } from "~/server/db/schema";
import { getI18n, resolveLocale } from "~/server/i18n";
import { getFederationContext } from "./federation";

/**
 * Federate a check-in as a Create(Note) activity from the user's proxy actor.
 * Follows the same pattern as announceEvent() in category.ts.
 */
export async function postCheckin(
  userId: string,
  checkin: { id: string; placeId: string; note: string | null },
  place: { id: string; name: string; latitude: string | null; longitude: string | null },
): Promise<void> {
  const ctx = getFederationContext();

  // Find user's local proxy actor, remote actor, and fediverse handle in parallel
  const [proxyRows, remoteRows, userRows] = await Promise.all([
    db
      .select()
      .from(actors)
      .where(and(eq(actors.userId, userId), eq(actors.type, "Person"), eq(actors.isLocal, true)))
      .limit(1),
    db
      .select({ actorUrl: actors.actorUrl, inboxUrl: actors.inboxUrl })
      .from(actors)
      .innerJoin(
        userFediverseAccounts,
        eq(actors.handle, userFediverseAccounts.fediverseHandle),
      )
      .where(and(
        eq(actors.userId, userId),
        eq(actors.type, "Person"),
        eq(actors.isLocal, false),
        eq(userFediverseAccounts.isPrimary, true),
      ))
      .limit(1),
    db
      .select({ fediverseHandle: userFediverseAccounts.fediverseHandle })
      .from(userFediverseAccounts)
      .where(and(eq(userFediverseAccounts.userId, userId), eq(userFediverseAccounts.isPrimary, true)))
      .limit(1),
  ]);
  const personActor = proxyRows[0];
  if (!personActor) return;
  const remoteActor = remoteRows[0];
  const user = userRows[0];

  const proxyHandle = personActor.handle;
  const locale = personActor.language;
  const i18n = getI18n(locale);
  const placeUrl = new URL(`/places/${place.id}`, ctx.canonicalOrigin).href;

  // Build mention tag for the user's original remote actor
  const mentionActorUrl = remoteActor?.actorUrl ?? personActor.actorUrl;
  const mentionHtml = user?.fediverseHandle
    ? ` by <a href="${mentionActorUrl}" class="u-url mention">@${user.fediverseHandle}</a>`
    : "";

  // Build HTML content
  const checkinText = i18n._("Checked in at <a href=\"{placeUrl}\">{placeName}</a>", {
    placeUrl,
    placeName: place.name,
  });
  const content = checkin.note
    ? `<p>${checkinText}${mentionHtml}</p>\n<p>${checkin.note}</p>`
    : `<p>${checkinText}${mentionHtml}</p>`;

  // Build Mention tags array
  const tags: Mention[] = [];
  if (user?.fediverseHandle) {
    tags.push(
      new Mention({
        href: new URL(mentionActorUrl),
        name: `@${user.fediverseHandle}`,
      }),
    );
  }

  // Look up the place's map image URL (may have been generated on place creation)
  const [placeRow] = await db
    .select({ mapImageUrl: placesTable.mapImageUrl })
    .from(placesTable)
    .where(eq(placesTable.id, place.id))
    .limit(1);
  const mapImageUrl = placeRow?.mapImageUrl ?? null;

  // Persist as post (for outbox inclusion)
  const now = new Date();
  const [post] = await db
    .insert(posts)
    .values({
      actorId: personActor.id,
      content,
      imageUrl: mapImageUrl,
      published: now,
    })
    .returning();

  const noteUri = ctx.getObjectUri(Note, { noteId: post.id });
  const published = Temporal.Instant.from(now.toISOString());

  // Build AP Place for the location property
  const apPlace = new Place({
    id: ctx.getObjectUri(Place, { placeId: place.id }),
    name: place.name,
    latitude: place.latitude ? parseFloat(place.latitude) : undefined,
    longitude: place.longitude ? parseFloat(place.longitude) : undefined,
  });

  // Always public (same pattern as announceEvent)
  const to = PUBLIC_COLLECTION;
  const ccs: (typeof PUBLIC_COLLECTION | URL)[] = [PUBLIC_COLLECTION, ctx.getFollowersUri(proxyHandle)];
  if (remoteActor?.actorUrl) {
    ccs.push(new URL(remoteActor.actorUrl));
  }

  // Build image attachment if map snapshot is available
  const attachments: Image[] = [];
  if (mapImageUrl) {
    attachments.push(
      new Image({
        url: new URL(mapImageUrl),
        mediaType: "image/png",
        name: i18n._("Map of {placeName}", { placeName: place.name }),
      }),
    );
  }

  const resolvedLocale = resolveLocale(locale);
  const note = new Note({
    id: noteUri,
    attribution: ctx.getActorUri(proxyHandle),
    content: new LanguageString(content, resolvedLocale),
    location: apPlace,
    attachments,
    tags,
    url: new URL(`/notes/${post.id}`, ctx.canonicalOrigin),
    published,
    to,
    ccs,
  });

  const createActivity = new Create({
    id: new URL(`${noteUri.href}#activity`),
    actor: ctx.getActorUri(proxyHandle),
    object: note,
    published,
    to,
    ccs,
  });

  // Send to proxy actor's followers
  await ctx.sendActivity(
    { identifier: proxyHandle },
    "followers",
    createActivity,
  );

  // Deliver directly to the mentioned remote actor (so they get a notification)
  if (remoteActor?.inboxUrl) {
    await ctx.sendActivity(
      { identifier: proxyHandle },
      {
        id: new URL(remoteActor.actorUrl),
        inboxId: new URL(remoteActor.inboxUrl),
      },
      createActivity,
    );
  }
}
