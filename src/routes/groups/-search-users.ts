import { ilike, or } from "drizzle-orm";
import { db } from "~/server/db/client";
import { users } from "~/server/db/schema";
import { getSessionUser } from "~/server/auth";

export const GET = async ({ request }: { request: Request }) => {
  const user = await getSessionUser(request);
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const q = url.searchParams.get("q")?.trim();
  if (!q || q.length < 2) {
    return Response.json({ users: [] });
  }

  const pattern = `%${q}%`;
  const results = await db
    .select({ handle: users.fediverseHandle, displayName: users.displayName })
    .from(users)
    .where(
      or(
        ilike(users.fediverseHandle, pattern),
        ilike(users.displayName, pattern),
      ),
    )
    .limit(10);

  return Response.json({ users: results });
};
