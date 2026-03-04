import { eq, and } from "drizzle-orm";
import { db } from "~/server/db/client";
import { actors } from "~/server/db/schema";
import { getSessionUser } from "~/server/auth";

export const GET = async ({ request }: { request: Request }) => {
  const user = await getSessionUser(request);
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [proxyActor] = await db
    .select({ language: actors.language })
    .from(actors)
    .where(
      and(
        eq(actors.userId, user.id),
        eq(actors.type, "Person"),
        eq(actors.isLocal, true),
      ),
    )
    .limit(1);

  return Response.json({
    language: proxyActor?.language ?? null,
  });
};

export const PATCH = async ({ request }: { request: Request }) => {
  const user = await getSessionUser(request);
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    language?: string;
  } | null;

  if (!body) {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const language = body.language?.trim() || null;

  await db
    .update(actors)
    .set({ language, updatedAt: new Date() })
    .where(
      and(
        eq(actors.userId, user.id),
        eq(actors.type, "Person"),
        eq(actors.isLocal, true),
      ),
    );

  return Response.json({ language });
};
