import { eq, and, sql } from "drizzle-orm";
import { db } from "~/server/db/client";
import { actors, events, eventOrganizers, eventQuestions, eventTiers, groupMembers, rsvpAnswers, rsvps } from "~/server/db/schema";
import { getSessionUser } from "~/server/auth";
import { getEventCategories } from "~/server/events/categories";
import { getAcceptedCount, autoPromoteWaitlist } from "~/server/events/waitlist";
import { sanitizeContactFields } from "~/server/events/rsvp-helpers";
import { persistRemoteActor } from "~/server/fediverse/resolve";
import { optional } from "~/server/controllers/utils";

export const POST = async ({ request }: { request: Request }) => {
  const user = await getSessionUser(request);
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    eventId?: string;
    title?: string;
    description?: string;
    categoryId?: string;
    groupActorId?: string | null;
    startsAt?: string;
    endsAt?: string;
    timezone?: string;
    location?: string;
    externalUrl?: string;
    placeId?: string | null;
    venueDetail?: string | null;
    headerImageUrl?: string | null;
    allowAnonymousRsvp?: boolean;
    anonymousContactFields?: { email?: string; phone?: string } | null;
    questions?: Array<{
      id?: string;
      question: string;
      sortOrder: number;
      required: boolean;
    }>;
    tiers?: Array<{
      id?: string;
      name: string;
      description?: string | null;
      price?: string | null;
      priceAmount?: number | null;
      sortOrder: number;
      opensAt?: string | null;
      closesAt?: string | null;
      capacity?: number | null;
    }>;
    organizerHandles?: string[];
    externalOrganizers?: Array<{ name: string; homepageUrl?: string }>;
  } | null;

  if (!body?.eventId || !body?.title?.trim() || !body?.startsAt) {
    return Response.json(
      { error: "eventId, title, and startsAt are required" },
      { status: 400 },
    );
  }

  // Look up the event
  const [event] = await db
    .select({
      id: events.id,
      organizerId: events.organizerId,
      groupActorId: events.groupActorId,
    })
    .from(events)
    .where(eq(events.id, body.eventId))
    .limit(1);

  if (!event) {
    return Response.json({ error: "Event not found" }, { status: 404 });
  }

  // Authorization
  if (event.groupActorId) {
    // Group event: verify user is host or moderator (join through actors to match any actor for this user)
    const [membership] = await db
      .select({ role: groupMembers.role })
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

    if (!membership) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }
  } else {
    // Personal event: only the organizer can edit
    if (event.organizerId !== user.id) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  // Group conversion: personal → group
  let convertingToGroup = false;
  if (body.groupActorId && !event.groupActorId) {
    // Verify user is a member of the target group
    const [targetMembership] = await db
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

    if (!targetMembership) {
      return Response.json({ error: "You are not a member of this group" }, { status: 403 });
    }
    convertingToGroup = true;
  }

  // Category validation (required for group events or when converting to group)
  const willBeGroupEvent = !!(body.groupActorId ?? event.groupActorId);
  if (willBeGroupEvent && !body.categoryId) {
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
    // Update event fields
    await db
      .update(events)
      .set({
        title: body.title.trim(),
        description: optional(body.description, (v) => v?.trim() || null),
        categoryId: optional(body.categoryId, (v) => v ?? null),
        startsAt,
        endsAt: optional(body.endsAt, () => endsAt ?? null),
        timezone: optional(body.timezone),
        location: optional(body.location, (v) => v?.trim() || null),
        externalUrl: optional(body.externalUrl, (v) => v?.trim() || ""),
        placeId: optional(body.placeId, (v) => v || null),
        venueDetail: optional(body.venueDetail, (v) => v?.trim() || null),
        headerImageUrl: optional(body.headerImageUrl, (v) => v || null),
        allowAnonymousRsvp: optional(body.allowAnonymousRsvp, (v) => !!v),
        anonymousContactFields: optional(body.allowAnonymousRsvp, (v) =>
          v ? sanitizeContactFields(body.anonymousContactFields) : null,
        ),
        ...(convertingToGroup
          ? { groupActorId: body.groupActorId!, published: false }
          : {}),
      })
      .where(eq(events.id, event.id));

    // Reconcile questions
    if (body.questions !== undefined) {
      const submittedIds = body.questions
        .filter((q) => q.id)
        .map((q) => q.id as string);

      // Delete questions not in submitted set (only those without answers)
      const existing = await db
        .select({ id: eventQuestions.id })
        .from(eventQuestions)
        .where(eq(eventQuestions.eventId, event.id));

      for (const eq_ of existing) {
        if (!submittedIds.includes(eq_.id)) {
          const [answerRow] = await db
            .select({ count: sql<number>`count(*)::int` })
            .from(rsvpAnswers)
            .where(eq(rsvpAnswers.questionId, eq_.id));

          if (answerRow.count === 0) {
            await db
              .delete(eventQuestions)
              .where(eq(eventQuestions.id, eq_.id));
          }
        }
      }

      // Upsert submitted questions
      for (const q of body.questions) {
        if (q.id && existing.some((e) => e.id === q.id)) {
          await db
            .update(eventQuestions)
            .set({
              question: q.question,
              sortOrder: q.sortOrder,
              required: q.required,
            })
            .where(eq(eventQuestions.id, q.id));
        } else {
          await db.insert(eventQuestions).values({
            eventId: event.id,
            question: q.question,
            sortOrder: q.sortOrder,
            required: q.required,
          });
        }
      }
    }

    // Reconcile tiers
    if (body.tiers !== undefined) {
      const submittedTierIds = body.tiers
        .filter((t) => t.id)
        .map((t) => t.id as string);

      const existingTiers = await db
        .select({ id: eventTiers.id })
        .from(eventTiers)
        .where(eq(eventTiers.eventId, event.id));

      // Delete tiers not in submitted set (only those without RSVPs)
      for (const et of existingTiers) {
        if (!submittedTierIds.includes(et.id)) {
          const [rsvpRow] = await db
            .select({ count: sql<number>`count(*)::int` })
            .from(rsvps)
            .where(eq(rsvps.tierId, et.id));

          if (rsvpRow.count === 0) {
            await db.delete(eventTiers).where(eq(eventTiers.id, et.id));
          }
        }
      }

      // Upsert submitted tiers
      for (const t of body.tiers) {
        const newCapacity = t.capacity === 0 ? null : (t.capacity ?? null);

        if (t.id && existingTiers.some((e) => e.id === t.id)) {
          // Read old capacity before updating
          const [oldTier] = await db
            .select({ capacity: eventTiers.capacity })
            .from(eventTiers)
            .where(eq(eventTiers.id, t.id));
          const oldCapacity = oldTier?.capacity ?? null;

          await db
            .update(eventTiers)
            .set({
              name: t.name,
              description: t.description !== undefined ? (t.description?.trim() || null) : undefined,
              price: t.price !== undefined ? (t.price?.trim() || null) : undefined,
              priceAmount: t.priceAmount !== undefined ? (t.priceAmount ?? null) : undefined,
              sortOrder: t.sortOrder,
              opensAt: t.opensAt ? new Date(t.opensAt) : null,
              closesAt: t.closesAt ? new Date(t.closesAt) : null,
              capacity: newCapacity,
            })
            .where(eq(eventTiers.id, t.id));

          // Auto-promote waitlisted RSVPs if capacity increased or removed
          if (newCapacity === null && oldCapacity !== null) {
            // Capacity removed → promote all waitlisted
            await autoPromoteWaitlist(db as any, t.id);
          } else if (newCapacity !== null && oldCapacity !== null && newCapacity > oldCapacity) {
            // Capacity increased → promote up to the new available spots
            const accepted = await getAcceptedCount(db as any, t.id);
            const spotsToFill = newCapacity - accepted;
            if (spotsToFill > 0) {
              await autoPromoteWaitlist(db as any, t.id, spotsToFill);
            }
          }
        } else {
          await db.insert(eventTiers).values({
            eventId: event.id,
            name: t.name,
            description: t.description?.trim() || null,
            price: t.price?.trim() || null,
            priceAmount: t.priceAmount ?? null,
            sortOrder: t.sortOrder,
            opensAt: t.opensAt ? new Date(t.opensAt) : null,
            closesAt: t.closesAt ? new Date(t.closesAt) : null,
            capacity: newCapacity,
          });
        }
      }

      // Safety: ensure at least one tier always exists
      const remainingTiers = await db
        .select({ id: eventTiers.id })
        .from(eventTiers)
        .where(eq(eventTiers.eventId, event.id));
      if (remainingTiers.length === 0) {
        await db.insert(eventTiers).values({
          eventId: event.id,
          name: "General",
          sortOrder: 0,
        });
      }
    }

    // Reconcile organizers (replace all when provided)
    if (body.organizerHandles !== undefined || body.externalOrganizers !== undefined) {
      // Delete all existing organizers
      await db
        .delete(eventOrganizers)
        .where(eq(eventOrganizers.eventId, event.id));

      // Insert actor-backed organizers
      for (const orgHandle of body.organizerHandles ?? []) {
        const handle = orgHandle.startsWith("@") ? orgHandle.slice(1) : orgHandle;
        try {
          const actor = await persistRemoteActor(handle);
          await db
            .insert(eventOrganizers)
            .values({ eventId: event.id, actorId: actor.id });
        } catch (err) {
          console.error(`Failed to resolve organizer ${handle}:`, err);
        }
      }

      // Insert external organizers
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
    }

    return Response.json({ event: { id: event.id, title: body.title.trim() } });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to update event";
    return Response.json({ error: message }, { status: 500 });
  }
};
