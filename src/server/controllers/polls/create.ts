import { eq, and } from "drizzle-orm";
import { db } from "~/server/db/client";
import { actors, groupMembers, polls, pollOptions } from "~/server/db/schema";
import { getSessionUser } from "~/server/auth";
import { publishPoll } from "~/server/fediverse/poll";

export const POST = async ({ request }: { request: Request }) => {
  const user = await getSessionUser(request);
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    groupActorId?: string;
    question?: string;
    type?: string;
    options?: string[];
    expiresAt?: string;
  } | null;

  if (!body?.groupActorId) {
    return Response.json({ error: "groupActorId is required" }, { status: 400 });
  }

  const groupActorId = body.groupActorId;

  if (!body.question?.trim()) {
    return Response.json({ error: "question is required" }, { status: 400 });
  }
  if (!body.type || !["single", "multiple"].includes(body.type)) {
    return Response.json({ error: "type must be 'single' or 'multiple'" }, { status: 400 });
  }
  if (!body.options || !Array.isArray(body.options) || body.options.length < 2) {
    return Response.json({ error: "At least 2 options are required" }, { status: 400 });
  }
  if (body.options.length > 20) {
    return Response.json({ error: "Maximum 20 options allowed" }, { status: 400 });
  }

  // Verify group exists
  const [group] = await db
    .select({ id: actors.id, handle: actors.handle })
    .from(actors)
    .where(and(eq(actors.id, groupActorId), eq(actors.type, "Group")))
    .limit(1);

  if (!group) {
    return Response.json({ error: "Group not found" }, { status: 404 });
  }

  // Verify user is a group member
  const [membership] = await db
    .select({ role: groupMembers.role })
    .from(groupMembers)
    .innerJoin(actors, eq(groupMembers.memberActorId, actors.id))
    .where(
      and(
        eq(groupMembers.groupActorId, group.id),
        eq(actors.userId, user.id),
        eq(actors.type, "Person"),
      ),
    )
    .limit(1);

  if (!membership) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    // Create poll
    const [poll] = await db
      .insert(polls)
      .values({
        groupActorId: group.id,
        question: body.question.trim(),
        type: body.type,
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined,
      })
      .returning();

    // Create options
    const optionValues = body.options.map((label, i) => ({
      pollId: poll.id,
      label: label.trim(),
      sortOrder: i,
    }));

    const options = await db
      .insert(pollOptions)
      .values(optionValues)
      .returning();

    // Federate
    await publishPoll(poll.id);

    return Response.json({
      poll: {
        id: poll.id,
        questionId: poll.questionId,
        question: poll.question,
        type: poll.type,
        expiresAt: poll.expiresAt,
        options: options.map((o) => ({ id: o.id, label: o.label, sortOrder: o.sortOrder })),
        createdAt: poll.createdAt,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to create poll";
    return Response.json({ error: message }, { status: 500 });
  }
};
