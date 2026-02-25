import { eq } from "drizzle-orm";
import { db } from "~/server/db/client";
import { posts, actors } from "~/server/db/schema";

export const GET = async ({ request }: { request: Request }) => {
  const url = new URL(request.url);
  const noteId = url.searchParams.get("id");

  if (!noteId) {
    return Response.json({ error: "id is required" }, { status: 400 });
  }

  const [row] = await db
    .select({
      id: posts.id,
      content: posts.content,
      published: posts.published,
      actorHandle: actors.handle,
      actorName: actors.name,
    })
    .from(posts)
    .innerJoin(actors, eq(posts.actorId, actors.id))
    .where(eq(posts.id, noteId))
    .limit(1);

  if (!row) {
    return Response.json({ error: "Note not found" }, { status: 404 });
  }

  return Response.json({ note: row });
};
