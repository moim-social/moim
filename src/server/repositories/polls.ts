import { eq } from "drizzle-orm";
import { db } from "~/server/db/client";
import { polls } from "~/server/db/schema";

export async function findPollIdByQuestionId(
  questionId: string,
): Promise<string | undefined> {
  const [poll] = await db
    .select({ id: polls.id })
    .from(polls)
    .where(eq(polls.questionId, questionId))
    .limit(1);

  return poll?.id;
}

export async function findQuestionIdByPollId(
  id: string,
): Promise<string | undefined> {
  const [poll] = await db
    .select({ questionId: polls.questionId })
    .from(polls)
    .where(eq(polls.id, id))
    .limit(1);

  return poll?.questionId;
}
