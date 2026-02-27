import { eq, and, sql } from "drizzle-orm";
import { db } from "~/server/db/client";
import { actors, events, eventQuestions, groupMembers, rsvpAnswers } from "~/server/db/schema";
import { getSessionUser } from "~/server/auth";
import { CATEGORIES } from "~/shared/categories";

const validCategoryIds = new Set(CATEGORIES.map((c) => c.id));

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
    startsAt?: string;
    endsAt?: string;
    location?: string;
    externalUrl?: string;
    questions?: Array<{
      id?: string;
      question: string;
      sortOrder: number;
      required: boolean;
    }>;
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
    // Group event: verify user is host or moderator
    const [personActor] = await db
      .select({ id: actors.id })
      .from(actors)
      .where(and(eq(actors.userId, user.id), eq(actors.type, "Person"), eq(actors.isLocal, true)))
      .limit(1);

    if (!personActor) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const [membership] = await db
      .select({ role: groupMembers.role })
      .from(groupMembers)
      .where(
        and(
          eq(groupMembers.groupActorId, event.groupActorId),
          eq(groupMembers.memberActorId, personActor.id),
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

  // Category validation
  if (event.groupActorId && !body.categoryId) {
    return Response.json({ error: "categoryId is required for group events" }, { status: 400 });
  }
  if (body.categoryId && !validCategoryIds.has(body.categoryId as any)) {
    return Response.json({ error: "Invalid categoryId" }, { status: 400 });
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
        description: body.description?.trim() || null,
        categoryId: body.categoryId ?? null,
        startsAt,
        endsAt: endsAt ?? null,
        location: body.location?.trim() || null,
        externalUrl: body.externalUrl?.trim() || "",
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

    return Response.json({ event: { id: event.id, title: body.title.trim() } });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to update event";
    return Response.json({ error: message }, { status: 500 });
  }
};
