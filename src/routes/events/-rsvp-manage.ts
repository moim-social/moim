import { eq, and } from "drizzle-orm";
import { db } from "~/server/db/client";
import { events, rsvps, actors, groupMembers } from "~/server/db/schema";
import { getSessionUser } from "~/server/auth";

export const PATCH = async ({ request, eventId, userId }: { request: Request; eventId: string; userId: string }) => {
  const user = await getSessionUser(request);
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    status?: "accepted" | "waitlisted";
  } | null;

  if (!body?.status || (body.status !== "accepted" && body.status !== "waitlisted")) {
    return Response.json({ error: "status must be 'accepted' or 'waitlisted'" }, { status: 400 });
  }

  // Get event and verify authorization
  const [event] = await db
    .select({ id: events.id, organizerId: events.organizerId, groupActorId: events.groupActorId })
    .from(events)
    .where(eq(events.id, eventId))
    .limit(1);

  if (!event) {
    return Response.json({ error: "Event not found" }, { status: 404 });
  }

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

  // Find the RSVP
  const [rsvp] = await db
    .select({ status: rsvps.status })
    .from(rsvps)
    .where(and(eq(rsvps.userId, userId), eq(rsvps.eventId, eventId)))
    .limit(1);

  if (!rsvp) {
    return Response.json({ error: "RSVP not found" }, { status: 404 });
  }

  if (rsvp.status === body.status) {
    return Response.json({ ok: true, status: body.status });
  }

  // Organizer override: directly set status (can promote beyond capacity)
  await db
    .update(rsvps)
    .set({ status: body.status })
    .where(and(eq(rsvps.userId, userId), eq(rsvps.eventId, eventId)));

  return Response.json({ ok: true, status: body.status });
};
