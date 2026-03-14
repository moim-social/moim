import { eq, sql, desc, count } from "drizzle-orm";
import { db } from "~/server/db/client";
import { actors, polls, pollOptions, pollVotes } from "~/server/db/schema";

export const GET = async ({ request }: { request: Request }) => {
  const url = new URL(request.url);
  const groupActorId = url.searchParams.get("groupActorId");
  if (!groupActorId) {
    return Response.json({ error: "groupActorId is required" }, { status: 400 });
  }

  const limit = Math.min(
    parseInt(url.searchParams.get("limit") ?? "20", 10),
    100,
  );
  const offset = parseInt(url.searchParams.get("offset") ?? "0", 10);

  // Verify group exists
  const [group] = await db
    .select({ id: actors.id })
    .from(actors)
    .where(eq(actors.id, groupActorId))
    .limit(1);

  if (!group) {
    return Response.json({ error: "Group not found" }, { status: 404 });
  }

  // Get polls with total count
  const pollRows = await db
    .select()
    .from(polls)
    .where(eq(polls.groupActorId, groupActorId))
    .orderBy(desc(polls.createdAt))
    .limit(limit)
    .offset(offset);

  const [totalResult] = await db
    .select({ count: count() })
    .from(polls)
    .where(eq(polls.groupActorId, groupActorId));

  // Get options and vote counts for each poll
  const pollsWithOptions = await Promise.all(
    pollRows.map(async (poll) => {
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

      return {
        id: poll.id,
        questionId: poll.questionId,
        question: poll.question,
        type: poll.type,
        closed: poll.closed,
        expiresAt: poll.expiresAt,
        createdAt: poll.createdAt,
        options: options.map((o) => ({
          id: o.id,
          label: o.label,
          sortOrder: o.sortOrder,
          count: o.voteCount,
        })),
        totalVoters: voterCount?.count ?? 0,
      };
    }),
  );

  return Response.json({
    polls: pollsWithOptions,
    total: totalResult?.count ?? 0,
  });
};
