import { eq, and } from "drizzle-orm";
import { db } from "~/server/db/client";
import { actors, groupMembers } from "~/server/db/schema";
import { getSessionUser, type SessionUser } from "~/server/auth";

export async function requireGroupMember(
  request: Request,
  groupActorId: string,
): Promise<{ user: SessionUser; role: string }> {
  const user = await getSessionUser(request);
  if (!user) {
    throw new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Fetch all memberships for this user (may have multiple linked accounts)
  const memberships = await db
    .select({ role: groupMembers.role })
    .from(groupMembers)
    .innerJoin(actors, eq(groupMembers.memberActorId, actors.id))
    .where(
      and(
        eq(groupMembers.groupActorId, groupActorId),
        eq(actors.userId, user.id),
        eq(actors.type, "Person"),
      ),
    );

  if (memberships.length === 0) {
    throw new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Return highest-privilege role (owner > moderator)
  const role = memberships.some((m) => m.role === "owner") ? "owner" : memberships[0].role;

  return { user, role };
}
