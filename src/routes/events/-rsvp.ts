import { eq, and } from "drizzle-orm";
import { db } from "~/server/db/client";
import { rsvps, rsvpAnswers, eventQuestions, events } from "~/server/db/schema";
import { getSessionUser } from "~/server/auth";

export const POST = async ({ request }: { request: Request }) => {
  const user = await getSessionUser(request);
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    eventId?: string;
    status?: "accepted" | "declined";
    answers?: Array<{ questionId: string; answer: string }>;
  } | null;

  if (!body?.eventId || !body?.status) {
    return Response.json({ error: "eventId and status are required" }, { status: 400 });
  }

  if (body.status !== "accepted" && body.status !== "declined") {
    return Response.json({ error: "status must be 'accepted' or 'declined'" }, { status: 400 });
  }

  // Verify event exists
  const [event] = await db
    .select({ id: events.id })
    .from(events)
    .where(eq(events.id, body.eventId))
    .limit(1);

  if (!event) {
    return Response.json({ error: "Event not found" }, { status: 404 });
  }

  // If accepting, validate required questions are answered
  if (body.status === "accepted") {
    const questions = await db
      .select({ id: eventQuestions.id, required: eventQuestions.required })
      .from(eventQuestions)
      .where(eq(eventQuestions.eventId, body.eventId));

    const requiredIds = new Set(
      questions.filter((q) => q.required).map((q) => q.id),
    );
    const answeredIds = new Set(
      (body.answers ?? []).filter((a) => a.answer.trim()).map((a) => a.questionId),
    );

    for (const reqId of requiredIds) {
      if (!answeredIds.has(reqId)) {
        return Response.json(
          { error: "All required questions must be answered" },
          { status: 400 },
        );
      }
    }
  }

  try {
    await db.transaction(async (tx) => {
      // Upsert RSVP
      await tx
        .insert(rsvps)
        .values({
          userId: user.id,
          eventId: body.eventId!,
          status: body.status!,
        })
        .onConflictDoUpdate({
          target: [rsvps.userId, rsvps.eventId],
          set: { status: body.status! },
        });

      // Delete old answers
      await tx
        .delete(rsvpAnswers)
        .where(
          and(
            eq(rsvpAnswers.userId, user.id),
            eq(rsvpAnswers.eventId, body.eventId!),
          ),
        );

      // Insert new answers (if accepting)
      if (body.status === "accepted" && body.answers && body.answers.length > 0) {
        const validAnswers = body.answers.filter((a) => a.answer.trim());
        if (validAnswers.length > 0) {
          await tx.insert(rsvpAnswers).values(
            validAnswers.map((a) => ({
              userId: user.id,
              eventId: body.eventId!,
              questionId: a.questionId,
              answer: a.answer,
            })),
          );
        }
      }
    });

    return Response.json({ ok: true, status: body.status });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to submit RSVP";
    return Response.json({ error: message }, { status: 500 });
  }
};
