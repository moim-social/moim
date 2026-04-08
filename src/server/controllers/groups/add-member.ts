import { eq, and } from "drizzle-orm";
import { Create, Mention, Note } from "@fedify/fedify";
import { Temporal } from "@js-temporal/polyfill";
import { db } from "~/server/db/client";
import { actors, groupMembers } from "~/server/db/schema";
import { requireGroupMember } from "~/server/group-auth";
import { persistRemoteActor } from "~/server/fediverse/resolve";
import { getFederationContext } from "~/server/fediverse/federation";
import { env } from "~/server/env";

export const POST = async ({ request }: { request: Request }) => {
  const body = (await request.json().catch(() => null)) as {
    groupActorId?: string;
    handle?: string;
  } | null;

  if (!body?.groupActorId) {
    return Response.json({ error: "groupActorId is required" }, { status: 400 });
  }

  // Only owners can add members
  const { role } = await requireGroupMember(request, body.groupActorId);
  if (role !== "owner") {
    return Response.json({ error: "Only owners can add members" }, { status: 403 });
  }

  if (!body.handle) {
    return Response.json({ error: "handle is required" }, { status: 400 });
  }

  const handle = body.handle.startsWith("@") ? body.handle.slice(1) : body.handle;

  // Resolve the actor
  let modActor: Awaited<ReturnType<typeof persistRemoteActor>>;
  try {
    modActor = await persistRemoteActor(handle);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to resolve handle";
    return Response.json({ error: message }, { status: 422 });
  }

  // Check for duplicate membership (exact actor match)
  const [existing] = await db
    .select({ id: groupMembers.id })
    .from(groupMembers)
    .where(
      and(
        eq(groupMembers.groupActorId, body.groupActorId),
        eq(groupMembers.memberActorId, modActor.id),
      ),
    )
    .limit(1);

  if (existing) {
    return Response.json({ error: "This user is already a member of the group" }, { status: 409 });
  }

  // Check for same identity via linked accounts (same userId, different actor)
  if (modActor.userId) {
    const [sameUser] = await db
      .select({ id: groupMembers.id, role: groupMembers.role })
      .from(groupMembers)
      .innerJoin(actors, eq(groupMembers.memberActorId, actors.id))
      .where(
        and(
          eq(groupMembers.groupActorId, body.groupActorId),
          eq(actors.userId, modActor.userId),
        ),
      )
      .limit(1);

    if (sameUser) {
      return Response.json(
        { error: `This user is already a member of the group (as ${sameUser.role}) via another linked account` },
        { status: 409 },
      );
    }
  }

  // Insert membership
  await db.insert(groupMembers).values({
    groupActorId: body.groupActorId,
    memberActorId: modActor.id,
    role: "moderator",
  });

  // Send ActivityPub mention notification
  const [group] = await db
    .select({ handle: actors.handle })
    .from(actors)
    .where(eq(actors.id, body.groupActorId))
    .limit(1);

  if (group && modActor.inboxUrl) {
    try {
      const ctx = getFederationContext();
      const instanceHostname = new URL(env.federationOrigin).hostname;
      const groupPageUrl = new URL(`/groups/@${group.handle}`, env.baseUrl).href;
      const content = `<p>You have been added as a moderator of <a href="${groupPageUrl}">@${group.handle}</a>.</p>`;

      const noteId = new URL(
        `/ap/notes/mention-${group.handle}-${Date.now()}`,
        env.baseUrl,
      );

      const note = new Note({
        id: noteId,
        attribution: ctx.getActorUri(instanceHostname),
        content,
        published: Temporal.Now.instant(),
        to: new URL(modActor.actorUrl),
        tags: [
          new Mention({
            href: new URL(modActor.actorUrl),
            name: `@${handle}`,
          }),
        ],
      });

      await ctx.sendActivity(
        { identifier: instanceHostname },
        {
          id: new URL(modActor.actorUrl),
          inboxId: new URL(modActor.inboxUrl),
        },
        new Create({
          id: new URL(`${noteId.href}#activity`),
          actor: ctx.getActorUri(instanceHostname),
          object: note,
          published: Temporal.Now.instant(),
          to: new URL(modActor.actorUrl),
        }),
      );
    } catch (err) {
      console.error(`Failed to send mention notification to ${handle}:`, err);
    }
  }

  return Response.json({
    member: {
      memberActorId: modActor.id,
      role: "moderator",
      handle: modActor.handle,
      name: modActor.name,
      actorUrl: modActor.actorUrl,
      isLocal: modActor.isLocal,
    },
  });
};
