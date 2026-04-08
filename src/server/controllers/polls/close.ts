import { eq, and } from "drizzle-orm";
import { db } from "~/server/db/client";
import { actors, groupMembers, polls } from "~/server/db/schema";
import { getSessionUser } from "~/server/auth";

export const POST = async ({ request }: { request: Request }) => {
  const user = await getSessionUser(request);
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    pollId?: string;
  } | null;

  if (!body?.pollId) {
    return Response.json({ error: "pollId is required" }, { status: 400 });
  }

  const pollId = body.pollId;

  // Load poll
  const [poll] = await db
    .select()
    .from(polls)
    .where(eq(polls.id, pollId))
    .limit(1);

  if (!poll) {
    return Response.json({ error: "Poll not found" }, { status: 404 });
  }

  if (poll.closed) {
    return Response.json({ error: "Poll is already closed" }, { status: 400 });
  }

  // Verify user is a group member
  const [membership] = await db
    .select({ role: groupMembers.role })
    .from(groupMembers)
    .innerJoin(actors, eq(groupMembers.memberActorId, actors.id))
    .where(
      and(
        eq(groupMembers.groupActorId, poll.groupActorId),
        eq(actors.userId, user.id),
        eq(actors.type, "Person"),
      ),
    )
    .limit(1);

  if (!membership) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  // Close the poll
  const [updated] = await db
    .update(polls)
    .set({ closed: true, updatedAt: new Date() })
    .where(eq(polls.id, pollId))
    .returning();

  return Response.json({
    poll: {
      id: updated.id,
      closed: updated.closed,
      updatedAt: updated.updatedAt,
    },
  });
};
