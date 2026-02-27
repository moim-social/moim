import { eq, and } from "drizzle-orm";
import { db } from "~/server/db/client";
import { actors, groupMembers } from "~/server/db/schema";
import { getSessionUser } from "~/server/auth";
import { createAndDeliverNote } from "~/server/fediverse/group";

export const POST = async ({ request }: { request: Request }) => {
  const user = await getSessionUser(request);
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    groupHandle?: string;
    content?: string;
  } | null;

  if (!body?.groupHandle || !body?.content?.trim()) {
    return Response.json(
      { error: "groupHandle and content are required" },
      { status: 400 },
    );
  }

  // Find the group actor
  const [group] = await db
    .select({ id: actors.id, handle: actors.handle })
    .from(actors)
    .where(and(eq(actors.handle, body.groupHandle), eq(actors.type, "Group")))
    .limit(1);

  if (!group) {
    return Response.json({ error: "Group not found" }, { status: 404 });
  }

  // Verify user is host or moderator (join through actors to match any actor for this user)
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
    // Wrap plain text in <p> tags
    const htmlContent = body.content
      .trim()
      .split(/\n\n+/)
      .map((p) => `<p>${p.replace(/\n/g, "<br>")}</p>`)
      .join("");

    const post = await createAndDeliverNote(group.handle, htmlContent);

    return Response.json({
      note: { id: post.id, content: post.content, published: post.published },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to create note";
    return Response.json({ error: message }, { status: 500 });
  }
};
