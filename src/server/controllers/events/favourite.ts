import { and, eq } from "drizzle-orm";
import { db } from "~/server/db/client";
import { eventFavourites } from "~/server/db/schema";
import { getSessionUser } from "~/server/auth";

export const GET = async ({ request }: { request: Request }) => {
  const url = new URL(request.url);
  const eventId = url.searchParams.get("eventId");

  if (!eventId) {
    return Response.json({ error: "eventId is required" }, { status: 400 });
  }

  const user = await getSessionUser(request);
  if (!user) {
    return Response.json({ isFavourite: false });
  }

  const [row] = await db
    .select({ id: eventFavourites.id })
    .from(eventFavourites)
    .where(
      and(
        eq(eventFavourites.userId, user.id),
        eq(eventFavourites.eventId, eventId),
      ),
    )
    .limit(1);

  return Response.json({ isFavourite: !!row });
};

export const POST = async ({ request }: { request: Request }) => {
  const user = await getSessionUser(request);
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    eventId?: string;
  } | null;

  if (!body?.eventId) {
    return Response.json({ error: "eventId is required" }, { status: 400 });
  }

  const { eventId } = body;

  // Check if already favourited
  const [existing] = await db
    .select({ id: eventFavourites.id })
    .from(eventFavourites)
    .where(
      and(
        eq(eventFavourites.userId, user.id),
        eq(eventFavourites.eventId, eventId),
      ),
    )
    .limit(1);

  if (existing) {
    // Remove favourite
    await db
      .delete(eventFavourites)
      .where(eq(eventFavourites.id, existing.id));
    return Response.json({ isFavourite: false });
  }

  // Add favourite
  await db.insert(eventFavourites).values({
    userId: user.id,
    eventId,
  });

  return Response.json({ isFavourite: true });
};
