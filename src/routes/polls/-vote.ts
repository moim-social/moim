import { eq, and } from "drizzle-orm";
import { db } from "~/server/db/client";
import { actors, polls, pollOptions, pollVotes } from "~/server/db/schema";
import { getSessionUser } from "~/server/auth";

export const POST = async ({ request }: { request: Request }) => {
  const user = await getSessionUser(request);
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    pollId?: string;
    optionIds?: string[];
  } | null;

  if (!body?.pollId) {
    return Response.json({ error: "pollId is required" }, { status: 400 });
  }
  if (!body.optionIds || !Array.isArray(body.optionIds) || body.optionIds.length === 0) {
    return Response.json({ error: "optionIds is required" }, { status: 400 });
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
    return Response.json({ error: "Poll is closed" }, { status: 400 });
  }
  if (poll.expiresAt && new Date(poll.expiresAt).getTime() < Date.now()) {
    return Response.json({ error: "Poll has expired" }, { status: 400 });
  }

  // Validate option count for poll type
  if (poll.type === "single" && body.optionIds.length !== 1) {
    return Response.json({ error: "Single-choice polls require exactly 1 option" }, { status: 400 });
  }

  // Verify all optionIds belong to this poll
  const validOptions = await db
    .select({ id: pollOptions.id })
    .from(pollOptions)
    .where(eq(pollOptions.pollId, poll.id));

  const validIds = new Set(validOptions.map((o) => o.id));
  for (const optionId of body.optionIds) {
    if (!validIds.has(optionId)) {
      return Response.json({ error: `Invalid option: ${optionId}` }, { status: 400 });
    }
  }

  // Resolve user's local actor URL
  const [userActor] = await db
    .select({ actorUrl: actors.actorUrl })
    .from(actors)
    .where(and(eq(actors.userId, user.id), eq(actors.type, "Person"), eq(actors.isLocal, true)))
    .limit(1);

  if (!userActor) {
    return Response.json({ error: "Actor not found" }, { status: 500 });
  }

  const voterActorUrl = userActor.actorUrl;
  const sourceInstance = new URL(voterActorUrl).hostname;

  // Delete existing votes for this voter on this poll (enables vote changing)
  await db
    .delete(pollVotes)
    .where(and(
      eq(pollVotes.pollId, poll.id),
      eq(pollVotes.voterActorUrl, voterActorUrl),
    ));

  // Insert new votes
  await db
    .insert(pollVotes)
    .values(
      body.optionIds.map((optionId) => ({
        pollId: poll.id,
        optionId,
        voterActorUrl,
        sourceInstance,
      })),
    );

  return Response.json({ success: true });
};
