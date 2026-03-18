import { eq, and } from "drizzle-orm";
import { db } from "~/server/db/client";
import { actors, events, eventOrganizers, eventQuestions, eventTiers, groupMembers, places, userFediverseAccounts } from "~/server/db/schema";
import { getSessionUser } from "~/server/auth";
import { persistRemoteActor } from "~/server/fediverse/resolve";
import { announceEvent } from "~/server/fediverse/category";
import { reverseGeocodeCountry } from "~/server/geo/reverse-geocode";
import { getEventCategories } from "~/server/events/categories";
import { sanitizeContactFields } from "~/server/events/rsvp-helpers";

export const POST = async ({ request }: { request: Request }) => {
  const user = await getSessionUser(request);
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    title?: string;
    description?: string;
    categoryId?: string;
    groupActorId?: string;
    startsAt?: string;
    endsAt?: string;
    timezone?: string;
    location?: string;
    externalUrl?: string;
    placeId?: string;
    venueDetail?: string;
    organizerHandles?: string[];
    questions?: Array<{
      question: string;
      sortOrder: number;
      required: boolean;
    }>;
    tiers?: Array<{
      name: string;
      description?: string;
      price?: string;
      sortOrder?: number;
      opensAt?: string;
      closesAt?: string;
      capacity?: number;
    }>;
    published?: boolean;
    allowAnonymousRsvp?: boolean;
    anonymousContactFields?: { email?: string; phone?: string };
    externalOrganizers?: Array<{ name: string; homepageUrl?: string }>;
  } | null;

  if (!body?.title || !body?.startsAt) {
    return Response.json(
      { error: "title and startsAt are required" },
      { status: 400 },
    );
  }

  // Look up user's Person actor
  const [personActor] = await db
    .select({ id: actors.id, handle: actors.handle })
    .from(actors)
    .where(and(eq(actors.userId, user.id), eq(actors.type, "Person"), eq(actors.isLocal, true)))
    .limit(1);

  if (!personActor) {
    return Response.json({ error: "You have no actor" }, { status: 403 });
  }

  let hostActorId: string;
  const isPersonalEvent = !body.groupActorId;

  if (body.groupActorId) {
    // Group event: verify membership (join through actors to match any actor for this user)
    const [membership] = await db
      .select({ role: groupMembers.role })
      .from(groupMembers)
      .innerJoin(actors, eq(groupMembers.memberActorId, actors.id))
      .where(
        and(
          eq(groupMembers.groupActorId, body.groupActorId),
          eq(actors.userId, user.id),
          eq(actors.type, "Person"),
        ),
      )
      .limit(1);

    if (!membership) {
      return Response.json(
        { error: "You are not a member of this group" },
        { status: 403 },
      );
    }
    hostActorId = body.groupActorId;
  } else {
    // Personal event: use user's proxy Person actor
    hostActorId = personActor.id;
  }

  // Category is required for group events, optional for personal
  if (body.groupActorId && !body.categoryId) {
    return Response.json({ error: "categoryId is required for group events" }, { status: 400 });
  }
  if (body.categoryId) {
    const allCategories = await getEventCategories();
    const validCategoryIds = new Set(allCategories.map((c) => c.slug));
    if (!validCategoryIds.has(body.categoryId)) {
      return Response.json({ error: "Invalid categoryId" }, { status: 400 });
    }
  }

  const startsAt = new Date(body.startsAt);
  if (Number.isNaN(startsAt.getTime())) {
    return Response.json({ error: "Invalid startsAt date" }, { status: 400 });
  }

  const endsAt = body.endsAt ? new Date(body.endsAt) : undefined;
  if (endsAt && Number.isNaN(endsAt.getTime())) {
    return Response.json({ error: "Invalid endsAt date" }, { status: 400 });
  }

  try {
    // Auto-detect country from place coordinates
    let country: string | null = null;
    if (body.placeId) {
      const [place] = await db
        .select({ latitude: places.latitude, longitude: places.longitude })
        .from(places)
        .where(eq(places.id, body.placeId))
        .limit(1);
      if (place?.latitude && place?.longitude) {
        const result = await reverseGeocodeCountry(
          parseFloat(place.latitude),
          parseFloat(place.longitude),
        );
        if (result) country = result.code;
      }
    }

    // Insert event
    const [event] = await db
      .insert(events)
      .values({
        organizerId: user.id,
        groupActorId: body.groupActorId ?? null,
        categoryId: body.categoryId ?? null,
        title: body.title,
        description: body.description ?? null,
        location: body.location ?? null,
        externalUrl: body.externalUrl ?? "",
        placeId: body.placeId ?? null,
        venueDetail: body.venueDetail?.trim() || null,
        country,
        published: body.published ?? (isPersonalEvent ? true : false),
        allowAnonymousRsvp: !!body.allowAnonymousRsvp,
        anonymousContactFields: body.allowAnonymousRsvp
          ? sanitizeContactFields(body.anonymousContactFields)
          : null,
        startsAt,
        endsAt: endsAt ?? null,
        timezone: body.timezone ?? null,
      })
      .returning();

    // Insert tiers (default "General" if none provided)
    const tiersToInsert = body.tiers && body.tiers.length > 0
      ? body.tiers.map((t, idx) => ({
          eventId: event.id,
          name: t.name,
          description: t.description ?? null,
          price: t.price ?? null,
          sortOrder: t.sortOrder ?? idx,
          opensAt: t.opensAt ? new Date(t.opensAt) : null,
          closesAt: t.closesAt ? new Date(t.closesAt) : null,
          capacity: t.capacity ?? null,
        }))
      : [{ eventId: event.id, name: "General", sortOrder: 0 }];
    await db.insert(eventTiers).values(tiersToInsert);

    // Insert survey questions
    if (body.questions && body.questions.length > 0) {
      await db.insert(eventQuestions).values(
        body.questions.map((q, idx) => ({
          eventId: event.id,
          question: q.question,
          sortOrder: q.sortOrder ?? idx,
          required: q.required ?? false,
        })),
      );
    }

    // Resolve organizer handles and insert junction records
    const organizers: Array<{ handle: string; actorUrl: string }> = [];
    for (const orgHandle of body.organizerHandles ?? []) {
      const handle = orgHandle.startsWith("@") ? orgHandle.slice(1) : orgHandle;
      try {
        const actor = await persistRemoteActor(handle);
        await db
          .insert(eventOrganizers)
          .values({ eventId: event.id, actorId: actor.id });
        organizers.push({ handle, actorUrl: actor.actorUrl });
      } catch (err) {
        console.error(`Failed to resolve organizer ${handle}:`, err);
      }
    }

    // Insert external organizers (no fediverse presence)
    for (const ext of body.externalOrganizers ?? []) {
      if (!ext.name?.trim()) continue;
      await db
        .insert(eventOrganizers)
        .values({
          eventId: event.id,
          name: ext.name.trim(),
          homepageUrl: ext.homepageUrl?.trim() || null,
        });
    }

    // Look up creator's remote actor for personal event mention
    let creatorMention: { handle: string; actorUrl: string; inboxUrl: string } | undefined;
    if (isPersonalEvent) {
      const [remoteActor] = await db
        .select({ handle: actors.handle, actorUrl: actors.actorUrl, inboxUrl: actors.inboxUrl })
        .from(actors)
        .innerJoin(
          userFediverseAccounts,
          eq(actors.handle, userFediverseAccounts.fediverseHandle),
        )
        .where(and(
          eq(actors.userId, user.id),
          eq(actors.isLocal, false),
          eq(userFediverseAccounts.isPrimary, true),
        ))
        .limit(1);
      if (remoteActor?.inboxUrl) {
        creatorMention = { handle: remoteActor.handle, actorUrl: remoteActor.actorUrl, inboxUrl: remoteActor.inboxUrl };
      }
    }

    // Host actor posts Note; category Service announces only for group events
    // Only federate if the event is published
    if (event.published) {
      await announceEvent(body.categoryId ?? null, hostActorId, event, organizers, {
        skipAnnounce: isPersonalEvent,
        creatorMention,
      });
    }

    return Response.json({
      event: { id: event.id, title: event.title, categoryId: event.categoryId },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to create event";
    return Response.json({ error: message }, { status: 500 });
  }
};
