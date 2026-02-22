import { Create, Mention, Note } from "@fedify/fedify";
import { Temporal } from "@js-temporal/polyfill";
import { db } from "~/server/db/client";
import { groupMembers } from "~/server/db/schema";
import { getSessionUser } from "~/server/auth";
import { createGroupActor } from "~/server/fediverse/group";
import { persistRemoteActor } from "~/server/fediverse/resolve";
import { getFederationContext } from "~/server/fediverse/federation";
import { env } from "~/server/env";
import { CATEGORIES } from "~/shared/categories";

const HANDLE_RE = /^[a-z0-9_]+$/;

export const POST = async ({ request }: { request: Request }) => {
  const user = await getSessionUser(request);
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    handle?: string;
    name?: string;
    summary?: string;
    website?: string;
    categories?: string[];
    moderatorHandles?: string[];
  } | null;

  if (!body?.handle || !body?.name || !body?.summary) {
    return Response.json(
      { error: "handle, name, and summary are required" },
      { status: 400 },
    );
  }

  if (!HANDLE_RE.test(body.handle)) {
    return Response.json(
      { error: "handle must be lowercase alphanumeric and underscores only" },
      { status: 400 },
    );
  }

  const validCategoryIds = new Set(CATEGORIES.map((c) => c.id));
  const categories = (body.categories ?? []).filter((c) => validCategoryIds.has(c as any));

  const website = body.website?.trim() || undefined;

  try {
    const actor = await createGroupActor(body.handle, body.name, body.summary, user.id, {
      website,
      categories,
    });

    // Process moderators
    const moderatorHandles = body.moderatorHandles ?? [];
    for (const modHandle of moderatorHandles) {
      const handle = modHandle.startsWith("@") ? modHandle.slice(1) : modHandle;
      try {
        const modActor = await persistRemoteActor(handle);

        await db.insert(groupMembers).values({
          groupActorId: actor.id,
          memberActorId: modActor.id,
          role: "moderator",
        });

        // Send mention notification via instance actor
        await sendMentionNotification(body.handle, handle, modActor);
      } catch (err) {
        console.error(`Failed to add moderator ${handle}:`, err);
        // Continue with other moderators even if one fails
      }
    }

    return Response.json({ group: { handle: actor.handle, name: actor.name } });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to create group";
    return Response.json({ error: message }, { status: 500 });
  }
};

async function sendMentionNotification(
  groupHandle: string,
  moderatorHandle: string,
  moderatorActor: { actorUrl: string; inboxUrl: string | null },
) {
  if (!moderatorActor.inboxUrl) return;

  const ctx = getFederationContext();
  const instanceHostname = new URL(env.federationOrigin).hostname;

  const content = `<p>You have been added as a moderator of <a href="${ctx.getActorUri(groupHandle).href}">@${groupHandle}</a>.</p>`;

  const noteId = new URL(
    `/ap/${instanceHostname}/notes/mention-${groupHandle}-${Date.now()}`,
    env.baseUrl,
  );

  const note = new Note({
    id: noteId,
    attribution: ctx.getActorUri(instanceHostname),
    content,
    published: Temporal.Now.instant(),
    to: new URL(moderatorActor.actorUrl),
    tags: [
      new Mention({
        href: new URL(moderatorActor.actorUrl),
        name: `@${moderatorHandle}`,
      }),
    ],
  });

  await ctx.sendActivity(
    { identifier: instanceHostname },
    {
      id: new URL(moderatorActor.actorUrl),
      inboxId: new URL(moderatorActor.inboxUrl),
    },
    new Create({
      id: new URL(`${noteId.href}#activity`),
      actor: ctx.getActorUri(instanceHostname),
      object: note,
      published: Temporal.Now.instant(),
      to: new URL(moderatorActor.actorUrl),
    }),
  );
}
