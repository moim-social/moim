import { Create, Note, PUBLIC_COLLECTION, Question } from "@fedify/fedify";
import type { Context } from "@fedify/fedify";
import { Temporal } from "@js-temporal/polyfill";
import { and, eq, countDistinct } from "drizzle-orm";
import { db } from "~/server/db/client";
import { actors, polls, pollOptions, pollVotes } from "~/server/db/schema";
import { getFederationContext } from "./federation";

/**
 * Publish a poll as a federated Question to the group's followers.
 */
export async function publishPoll(pollId: string): Promise<void> {
  const ctx = getFederationContext();

  // Load poll + group actor
  const [poll] = await db
    .select()
    .from(polls)
    .where(eq(polls.id, pollId))
    .limit(1);
  if (!poll) throw new Error(`Poll not found: ${pollId}`);

  const [groupActor] = await db
    .select()
    .from(actors)
    .where(and(eq(actors.id, poll.groupActorId), eq(actors.isLocal, true)))
    .limit(1);
  if (!groupActor) throw new Error(`Group actor not found: ${poll.groupActorId}`);

  // Load options
  const options = await db
    .select()
    .from(pollOptions)
    .where(eq(pollOptions.pollId, pollId))
    .orderBy(pollOptions.sortOrder);

  const optionNotes = options.map((o) => new Note({ name: o.label }));

  const questionUri = ctx.getObjectUri(Question, { questionId: poll.questionId });
  const published = Temporal.Instant.from(poll.createdAt.toISOString());

  const question = new Question({
    id: questionUri,
    attribution: ctx.getActorUri(groupActor.handle),
    content: poll.question,
    ...(poll.type === "single"
      ? { exclusiveOptions: optionNotes }
      : { inclusiveOptions: optionNotes }),
    ...(poll.expiresAt
      ? {
          closed: Temporal.Instant.from(poll.expiresAt.toISOString()),
          endTime: Temporal.Instant.from(poll.expiresAt.toISOString()),
        }
      : {}),
    voters: 0,
    published,
    to: PUBLIC_COLLECTION,
    ccs: [PUBLIC_COLLECTION, ctx.getFollowersUri(groupActor.handle)],
  });

  const createActivity = new Create({
    id: new URL(`${questionUri.href}#activity`),
    actor: ctx.getActorUri(groupActor.handle),
    object: question,
    published,
    to: PUBLIC_COLLECTION,
    ccs: [PUBLIC_COLLECTION, ctx.getFollowersUri(groupActor.handle)],
  });

  await ctx.sendActivity(
    { identifier: groupActor.handle },
    "followers",
    createActivity,
  );
}

/**
 * Build a Question object for a poll (used by the Question dispatcher).
 */
export async function buildPollQuestion(
  ctx: Context<void>,
  poll: typeof polls.$inferSelect,
  groupActor: typeof actors.$inferSelect,
): Promise<Question> {
  const options = await db
    .select()
    .from(pollOptions)
    .where(eq(pollOptions.pollId, poll.id))
    .orderBy(pollOptions.sortOrder);

  const [voterCount] = await db
    .select({ count: countDistinct(pollVotes.voterActorUrl) })
    .from(pollVotes)
    .where(eq(pollVotes.pollId, poll.id));

  const optionNotes = options.map((o) => new Note({ name: o.label }));

  const questionUri = ctx.getObjectUri(Question, { questionId: poll.questionId });
  const published = Temporal.Instant.from(poll.createdAt.toISOString());

  return new Question({
    id: questionUri,
    attribution: ctx.getActorUri(groupActor.handle),
    content: poll.question,
    ...(poll.type === "single"
      ? { exclusiveOptions: optionNotes }
      : { inclusiveOptions: optionNotes }),
    ...(poll.expiresAt
      ? {
          closed: Temporal.Instant.from(poll.expiresAt.toISOString()),
          endTime: Temporal.Instant.from(poll.expiresAt.toISOString()),
        }
      : {}),
    ...(poll.closed ? { closed: Temporal.Now.instant() } : {}),
    voters: voterCount?.count ?? 0,
    published,
    to: PUBLIC_COLLECTION,
    ccs: [PUBLIC_COLLECTION],
  });
}
