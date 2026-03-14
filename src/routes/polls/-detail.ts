import { eq, sql } from "drizzle-orm";
import { db } from "~/server/db/client";
import { polls, pollOptions, pollVotes } from "~/server/db/schema";

export const GET = async ({ request }: { request: Request }) => {
  const url = new URL(request.url);
  const pollId = url.searchParams.get("pollId");
  if (!pollId) {
    return Response.json({ error: "pollId is required" }, { status: 400 });
  }

  const [poll] = await db
    .select()
    .from(polls)
    .where(eq(polls.id, pollId))
    .limit(1);

  if (!poll) {
    return Response.json({ error: "Poll not found" }, { status: 404 });
  }

  const options = await db
    .select({
      id: pollOptions.id,
      label: pollOptions.label,
      sortOrder: pollOptions.sortOrder,
      voteCount: sql<number>`cast(count(${pollVotes.id}) as int)`,
    })
    .from(pollOptions)
    .leftJoin(pollVotes, eq(pollVotes.optionId, pollOptions.id))
    .where(eq(pollOptions.pollId, poll.id))
    .groupBy(pollOptions.id, pollOptions.label, pollOptions.sortOrder)
    .orderBy(pollOptions.sortOrder);

  const [voterCount] = await db
    .select({ count: sql<number>`cast(count(distinct ${pollVotes.voterActorUrl}) as int)` })
    .from(pollVotes)
    .where(eq(pollVotes.pollId, poll.id));

  return Response.json({
    poll: {
      id: poll.id,
      questionId: poll.questionId,
      question: poll.question,
      type: poll.type,
      closed: poll.closed,
      expiresAt: poll.expiresAt,
      createdAt: poll.createdAt,
      groupActorId: poll.groupActorId,
      options: options.map((o) => ({
        id: o.id,
        label: o.label,
        sortOrder: o.sortOrder,
        count: o.voteCount,
      })),
      totalVoters: voterCount?.count ?? 0,
    },
  });
};
