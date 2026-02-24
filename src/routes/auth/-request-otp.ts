import { Create, Note, Question } from "@fedify/fedify";
import { Temporal } from "@js-temporal/polyfill";
import { db } from "~/server/db/client";
import { otpChallenges } from "~/server/db/schema";
import { env } from "~/server/env";
import { getFederationContext } from "~/server/fediverse/federation";
import { EMOJI_SET, generateEmojiChallenge } from "~/server/fediverse/otp";
import { persistRemoteActor } from "~/server/fediverse/resolve";

export const POST = async ({ request }: { request: Request }) => {
  const body = (await request.json().catch(() => null)) as {
    handle?: string;
  } | null;

  if (!body?.handle) {
    return Response.json({ error: "handle is required" }, { status: 400 });
  }

  const handle = body.handle.startsWith("@") ? body.handle.slice(1) : body.handle;

  // Resolve and persist the remote actor before generating OTP
  let actor;
  try {
    actor = await persistRemoteActor(handle);
  } catch (err) {
    return Response.json(
      { error: `Could not resolve actor: ${(err as Error).message}` },
      { status: 422 },
    );
  }

  if (!actor.inboxUrl) {
    return Response.json(
      { error: "Actor has no inbox URL" },
      { status: 422 },
    );
  }

  const expectedEmojis = generateEmojiChallenge();
  const expiresAt = new Date(Date.now() + env.otpTtlSeconds * 1000);

  const [challenge] = await db
    .insert(otpChallenges)
    .values({
      handle,
      expectedEmojis,
      actorUrl: actor.actorUrl,
      status: "pending",
      expiresAt,
    })
    .returning();

  // Build and send the DM poll (Question wrapped in Create for Mastodon compatibility)
  const ctx = getFederationContext();
  const instanceId = new URL(env.federationOrigin).hostname;
  const questionUri = ctx.getObjectUri(Question, {
    questionId: challenge.questionId,
  });

  const question = new Question({
    id: questionUri,
    attribution: ctx.getActorUri(instanceId),
    to: new URL(actor.actorUrl),
    content: "Select the highlighted emojis to sign in to Moim:",
    inclusiveOptions: EMOJI_SET.map((emoji) => new Note({ name: emoji })),
    closed: Temporal.Instant.from(expiresAt.toISOString()),
  });

  const createActivity = new Create({
    id: new URL(`${questionUri.href}#activity`),
    actor: ctx.getActorUri(instanceId),
    to: new URL(actor.actorUrl),
    object: question,
  });

  try {
    await ctx.sendActivity(
      { identifier: instanceId },
      {
        id: new URL(actor.actorUrl),
        inboxId: new URL(actor.inboxUrl),
      },
      createActivity,
    );
  } catch (err) {
    console.error("Failed to send OTP poll:", err);
    return Response.json(
      { error: "Failed to send poll to your Fediverse account" },
      { status: 502 },
    );
  }

  return Response.json({
    handle,
    challengeId: challenge.id,
    expectedEmojis,
    allEmojis: [...EMOJI_SET],
    expiresAt: expiresAt.toISOString(),
    actorName: actor.name,
    instruction:
      "A poll has been sent to your Fediverse account as a DM. Select the highlighted emojis, then wait.",
  });
};
