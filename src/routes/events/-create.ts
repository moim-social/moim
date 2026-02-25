import { eq, and } from "drizzle-orm";
import { db } from "~/server/db/client";
import { actors, events, eventOrganizers, eventQuestions, groupMembers } from "~/server/db/schema";
import { getSessionUser } from "~/server/auth";
import { persistRemoteActor } from "~/server/fediverse/resolve";
import { announceEvent } from "~/server/fediverse/category";
import { CATEGORIES } from "~/shared/categories";

const validCategoryIds = new Set(CATEGORIES.map((c) => c.id));

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
    location?: string;
    organizerHandles?: string[];
    questions?: Array<{
      question: string;
      sortOrder: number;
      required: boolean;
    }>;
  } | null;

  if (!body?.title || !body?.categoryId || !body?.startsAt || !body?.groupActorId) {
    return Response.json(
      { error: "title, categoryId, groupActorId, and startsAt are required" },
      { status: 400 },
    );
  }

  // Verify the group exists and the user is a host or moderator
  const [personActor] = await db
    .select({ id: actors.id })
    .from(actors)
    .where(eq(actors.userId, user.id))
    .limit(1);

  if (!personActor) {
    return Response.json({ error: "You have no actor" }, { status: 403 });
  }

  const [membership] = await db
    .select({ role: groupMembers.role })
    .from(groupMembers)
    .where(
      and(
        eq(groupMembers.groupActorId, body.groupActorId),
        eq(groupMembers.memberActorId, personActor.id),
      ),
    )
    .limit(1);

  if (!membership) {
    return Response.json(
      { error: "You are not a member of this group" },
      { status: 403 },
    );
  }

  if (!validCategoryIds.has(body.categoryId as any)) {
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
    // Insert event
    const [event] = await db
      .insert(events)
      .values({
        organizerId: user.id,
        groupActorId: body.groupActorId,
        categoryId: body.categoryId,
        title: body.title,
        description: body.description ?? null,
        location: body.location ?? null,
        startsAt,
        endsAt: endsAt ?? null,
      })
      .returning();

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
          .values({ eventId: event.id, actorId: actor.id })
          .onConflictDoNothing();
        organizers.push({ handle, actorUrl: actor.actorUrl });
      } catch (err) {
        console.error(`Failed to resolve organizer ${handle}:`, err);
      }
    }

    // Group actor posts Note, category Service actor announces it
    await announceEvent(body.categoryId, body.groupActorId, event, organizers);

    return Response.json({
      event: { id: event.id, title: event.title, categoryId: event.categoryId },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to create event";
    return Response.json({ error: message }, { status: 500 });
  }
};
