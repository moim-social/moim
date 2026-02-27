import { eq, and } from "drizzle-orm";
import { db } from "~/server/db/client";
import { actors, groupMembers } from "~/server/db/schema";
import { getSessionUser } from "~/server/auth";
import { CATEGORIES } from "~/shared/categories";

const validCategoryIds = new Set(CATEGORIES.map((c) => c.id));

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
  } | null;

  if (!body?.handle || !body?.name?.trim() || !body?.summary?.trim()) {
    return Response.json(
      { error: "handle, name, and summary are required" },
      { status: 400 },
    );
  }

  // Find the group actor
  const [group] = await db
    .select({ id: actors.id, handle: actors.handle })
    .from(actors)
    .where(and(eq(actors.handle, body.handle), eq(actors.type, "Group")))
    .limit(1);

  if (!group) {
    return Response.json({ error: "Group not found" }, { status: 404 });
  }

  // Verify user is host or moderator
  const [personActor] = await db
    .select({ id: actors.id })
    .from(actors)
    .where(eq(actors.userId, user.id))
    .limit(1);

  if (!personActor) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const [membership] = await db
    .select({ role: groupMembers.role })
    .from(groupMembers)
    .where(
      and(
        eq(groupMembers.groupActorId, group.id),
        eq(groupMembers.memberActorId, personActor.id),
      ),
    )
    .limit(1);

  if (!membership) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const categories = (body.categories ?? []).filter((c) =>
    validCategoryIds.has(c as any),
  );

  try {
    await db
      .update(actors)
      .set({
        name: body.name.trim(),
        summary: body.summary.trim(),
        website: body.website?.trim() || null,
        categories: categories.length > 0 ? categories : null,
        updatedAt: new Date(),
      })
      .where(eq(actors.id, group.id));

    return Response.json({ group: { handle: group.handle, name: body.name.trim() } });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to update group";
    return Response.json({ error: message }, { status: 500 });
  }
};
