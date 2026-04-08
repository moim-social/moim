import { eq, and } from "drizzle-orm";
import { Update, PUBLIC_COLLECTION } from "@fedify/fedify";
import { db } from "~/server/db/client";
import { actors, groupMembers } from "~/server/db/schema";
import { getSessionUser } from "~/server/auth";
import { createThumbnail } from "~/server/avatars/process";
import { uploadBuffer } from "~/server/storage/s3";
import { env } from "~/server/env";
import { getRequestContext } from "~/server/fediverse/federation";

export const POST = async ({ request }: { request: Request }) => {
  const user = await getSessionUser(request);
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData().catch(() => null);
  if (!formData) {
    return Response.json({ error: "Invalid form data" }, { status: 400 });
  }

  const handle = formData.get("handle") as string | null;
  const avatarFile = formData.get("avatar") as File | null;

  if (!handle || !avatarFile || avatarFile.size === 0) {
    return Response.json(
      { error: "handle and avatar file are required" },
      { status: 400 },
    );
  }

  // Validate file type
  if (!avatarFile.type.startsWith("image/")) {
    return Response.json({ error: "File must be an image" }, { status: 400 });
  }

  // Limit file size to 5MB
  if (avatarFile.size > 5 * 1024 * 1024) {
    return Response.json(
      { error: "File too large (max 5MB)" },
      { status: 400 },
    );
  }

  // Find the group actor
  const [group] = await db
    .select({ id: actors.id, handle: actors.handle })
    .from(actors)
    .where(and(eq(actors.handle, handle), eq(actors.type, "Group")))
    .limit(1);

  if (!group) {
    return Response.json({ error: "Group not found" }, { status: 404 });
  }

  // Verify user is host or moderator
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
    const rawBuffer = Buffer.from(await avatarFile.arrayBuffer());
    const thumbnail = await createThumbnail(rawBuffer);
    const key = `avatars/${group.id}.webp`;

    await uploadBuffer(key, thumbnail, "image/webp");

    const avatarUrl = `${env.baseUrl}/avatars/${group.id}.webp`;
    const now = new Date();
    await db
      .update(actors)
      .set({ avatarUrl, updatedAt: now })
      .where(eq(actors.id, group.id));

    // Propagate Update(Group) to followers
    try {
      const ctx = getRequestContext(request);
      await ctx.sendActivity(
        { identifier: handle },
        "followers",
        new Update({
          id: new URL(
            `#update/${now.toISOString()}`,
            ctx.getActorUri(handle),
          ),
          actor: ctx.getActorUri(handle),
          to: PUBLIC_COLLECTION,
          object: await ctx.getActor(handle),
        }),
        {
          preferSharedInbox: true,
          excludeBaseUris: [new URL(ctx.canonicalOrigin)],
        },
      );
    } catch {
      // Federation delivery failure is non-blocking
    }

    return Response.json({ avatarUrl });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Failed to upload avatar";
    return Response.json({ error: message }, { status: 500 });
  }
};
