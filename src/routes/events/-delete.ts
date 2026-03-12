import { eq, and, sql } from "drizzle-orm";
import { db } from "~/server/db/client";
import { actors, events, groupMembers, rsvps } from "~/server/db/schema";
import { getSessionUser } from "~/server/auth";

export const DELETE = async ({ request }: { request: Request }) => {
  const user = await getSessionUser(request);
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const eventId = url.searchParams.get("eventId");

  if (!eventId) {
    return Response.json({ error: "eventId is required" }, { status: 400 });
  }

  const [event] = await db
    .select({
      id: events.id,
      organizerId: events.organizerId,
      groupActorId: events.groupActorId,
    })
    .from(events)
    .where(eq(events.id, eventId))
    .limit(1);

  if (!event) {
    return Response.json({ error: "Event not found" }, { status: 404 });
  }

  // Authorization
  if (event.groupActorId) {
    const [membership] = await db
      .select({ role: groupMembers.role })
      .from(groupMembers)
      .innerJoin(actors, eq(groupMembers.memberActorId, actors.id))
      .where(
        and(
          eq(groupMembers.groupActorId, event.groupActorId),
          eq(actors.userId, user.id),
          eq(actors.type, "Person"),
        ),
      )
      .limit(1);

    if (!membership) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }
  } else {
    if (event.organizerId !== user.id) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  // Check for accepted RSVPs
  const [rsvpCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(rsvps)
    .where(and(eq(rsvps.eventId, eventId), eq(rsvps.status, "accepted")));

  if (rsvpCount && rsvpCount.count > 0) {
    return Response.json(
      { error: "Cannot delete event with RSVPs" },
      { status: 403 },
    );
  }

  // Soft delete
  await db
    .update(events)
    .set({ deletedAt: new Date() })
    .where(eq(events.id, eventId));

  return Response.json({ ok: true });
};
