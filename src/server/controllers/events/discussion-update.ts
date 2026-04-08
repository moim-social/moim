import { eq, and } from "drizzle-orm";
import { db } from "~/server/db/client";
import {
  events,
  actors,
  groupMembers,
  posts,
} from "~/server/db/schema";
import { getSessionUser } from "~/server/auth";

const VALID_STATUSES = ["new", "needs_response", "resolved"] as const;

export const PATCH = async ({ request }: { request: Request }) => {
  const user = await getSessionUser(request);
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as {
    eventId?: string;
    inquiryId?: string;
    threadStatus?: string;
  };

  const { eventId, inquiryId, threadStatus } = body;
  if (!eventId || !inquiryId || !threadStatus) {
    return Response.json(
      { error: "eventId, inquiryId, and threadStatus are required" },
      { status: 400 },
    );
  }

  if (!VALID_STATUSES.includes(threadStatus as (typeof VALID_STATUSES)[number])) {
    return Response.json(
      { error: `threadStatus must be one of: ${VALID_STATUSES.join(", ")}` },
      { status: 400 },
    );
  }

  // Get event + access check
  const [event] = await db
    .select({ id: events.id, groupActorId: events.groupActorId })
    .from(events)
    .where(eq(events.id, eventId))
    .limit(1);

  if (!event) {
    return Response.json({ error: "Event not found" }, { status: 404 });
  }
  if (!event.groupActorId) {
    return Response.json(
      { error: "Discussions are only available for group events" },
      { status: 400 },
    );
  }

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

  // Update thread status
  const [updated] = await db
    .update(posts)
    .set({ threadStatus })
    .where(and(eq(posts.id, inquiryId), eq(posts.eventId, eventId)))
    .returning({ id: posts.id, threadStatus: posts.threadStatus });

  if (!updated) {
    return Response.json({ error: "Inquiry not found" }, { status: 404 });
  }

  return Response.json({ inquiry: updated });
};
