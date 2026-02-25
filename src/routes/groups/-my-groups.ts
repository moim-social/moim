import { eq } from "drizzle-orm";
import { db } from "~/server/db/client";
import { actors, groupMembers } from "~/server/db/schema";
import { getSessionUser } from "~/server/auth";

export const GET = async ({ request }: { request: Request }) => {
  const user = await getSessionUser(request);
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Find the user's Person actor
  const [personActor] = await db
    .select({ id: actors.id })
    .from(actors)
    .where(eq(actors.userId, user.id))
    .limit(1);

  if (!personActor) {
    return Response.json({ groups: [] });
  }

  // Find all groups where the user is host or moderator
  const rows = await db
    .select({
      id: actors.id,
      handle: actors.handle,
      name: actors.name,
    })
    .from(groupMembers)
    .innerJoin(actors, eq(groupMembers.groupActorId, actors.id))
    .where(eq(groupMembers.memberActorId, personActor.id));

  return Response.json({ groups: rows });
};
