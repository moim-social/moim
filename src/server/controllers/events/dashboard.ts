import { eq, and, sql } from "drizzle-orm";
import { db } from "~/server/db/client";
import {
  events,
  rsvps,
  users,
  actors,
  groupMembers,
  activityLogs,
  userFediverseAccounts,
  eventTiers,
} from "~/server/db/schema";
import { getSessionUser } from "~/server/auth";

export const GET = async ({ request }: { request: Request }) => {
  const user = await getSessionUser(request);
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const eventId = url.searchParams.get("eventId");
  if (!eventId) {
    return Response.json({ error: "eventId is required" }, { status: 400 });
  }

  // Get event
  const [event] = await db
    .select({
      id: events.id,
      title: events.title,
      description: events.description,
      categoryId: events.categoryId,
      startsAt: events.startsAt,
      endsAt: events.endsAt,
      location: events.location,
      timezone: events.timezone,
      organizerId: events.organizerId,
      groupActorId: events.groupActorId,
      published: events.published,
      createdAt: events.createdAt,
    })
    .from(events)
    .where(eq(events.id, eventId))
    .limit(1);

  if (!event) {
    return Response.json({ error: "Event not found" }, { status: 404 });
  }

  // Access control: organizer for personal events, group member for group events
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

  // RSVP counts
  const rsvpCountRows = await db
    .select({
      status: rsvps.status,
      count: sql<number>`count(*)::int`,
    })
    .from(rsvps)
    .where(eq(rsvps.eventId, eventId))
    .groupBy(rsvps.status);

  const rsvpCounts = {
    accepted: rsvpCountRows.find((c) => c.status === "accepted")?.count ?? 0,
    declined: rsvpCountRows.find((c) => c.status === "declined")?.count ?? 0,
    waitlisted: rsvpCountRows.find((c) => c.status === "waitlisted")?.count ?? 0,
    total: rsvpCountRows.reduce((sum, c) => sum + c.count, 0),
  };

  // Attendee list
  const attendees = await db
    .select({
      userId: rsvps.userId,
      status: rsvps.status,
      createdAt: rsvps.createdAt,
      handle: userFediverseAccounts.fediverseHandle,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
      tierName: eventTiers.name,
    })
    .from(rsvps)
    .innerJoin(users, eq(rsvps.userId, users.id))
    .leftJoin(userFediverseAccounts, and(
      eq(userFediverseAccounts.userId, users.id),
      eq(userFediverseAccounts.isPrimary, true),
    ))
    .leftJoin(eventTiers, eq(rsvps.tierId, eventTiers.id))
    .where(eq(rsvps.eventId, eventId));

  // Engagement counts from activity_logs directly by eventId
  const engagementRows = await db
    .select({
      type: activityLogs.type,
      count: sql<number>`count(*)::int`,
    })
    .from(activityLogs)
    .where(eq(activityLogs.eventId, eventId))
    .groupBy(activityLogs.type);

  const engagementCounts = {
    reactions: (engagementRows.find((r) => r.type === "like")?.count ?? 0) +
      (engagementRows.find((r) => r.type === "emoji_react")?.count ?? 0),
    announces: engagementRows.find((r) => r.type === "announce")?.count ?? 0,
    replies: engagementRows.find((r) => r.type === "reply")?.count ?? 0,
    quotes: engagementRows.find((r) => r.type === "quote")?.count ?? 0,
  };

  const recentActivity = await db
    .select({
      id: activityLogs.id,
      type: activityLogs.type,
      emoji: activityLogs.emoji,
      content: activityLogs.content,
      createdAt: activityLogs.createdAt,
      actorHandle: actors.handle,
      actorName: actors.name,
    })
    .from(activityLogs)
    .innerJoin(actors, eq(activityLogs.actorId, actors.id))
    .where(eq(activityLogs.eventId, eventId))
    .orderBy(sql`${activityLogs.createdAt} DESC`)
    .limit(20);

  // Per-participant engagement breakdown
  const participantEngagement = await db
    .select({
      actorId: activityLogs.actorId,
      actorHandle: actors.handle,
      actorName: actors.name,
      reactionCount: sql<number>`count(*) filter (where ${activityLogs.type} in ('like', 'emoji_react'))::int`,
      replyCount: sql<number>`count(*) filter (where ${activityLogs.type} in ('reply', 'quote'))::int`,
      announceCount: sql<number>`count(*) filter (where ${activityLogs.type} = 'announce')::int`,
      totalEngagement: sql<number>`count(*)::int`,
    })
    .from(activityLogs)
    .innerJoin(actors, eq(activityLogs.actorId, actors.id))
    .where(eq(activityLogs.eventId, eventId))
    .groupBy(activityLogs.actorId, actors.handle, actors.name)
    .orderBy(sql`count(*) DESC`);

  // Tiers with RSVP counts (filtered by status)
  const tiers = await db
    .select({
      id: eventTiers.id,
      name: eventTiers.name,
      description: eventTiers.description,
      price: eventTiers.price,
      opensAt: eventTiers.opensAt,
      closesAt: eventTiers.closesAt,
      capacity: eventTiers.capacity,
      sortOrder: eventTiers.sortOrder,
      acceptedCount: sql<number>`count(${rsvps.userId}) filter (where ${rsvps.status} = 'accepted')::int`,
      waitlistedCount: sql<number>`count(${rsvps.userId}) filter (where ${rsvps.status} = 'waitlisted')::int`,
    })
    .from(eventTiers)
    .leftJoin(rsvps, eq(rsvps.tierId, eventTiers.id))
    .where(eq(eventTiers.eventId, eventId))
    .groupBy(eventTiers.id)
    .orderBy(eventTiers.sortOrder);

  // Compute event status
  const now = new Date();
  const status =
    new Date(event.startsAt) > now
      ? "upcoming"
      : event.endsAt && new Date(event.endsAt) < now
        ? "ended"
        : "ongoing";

  return Response.json({
    event: { ...event, status },
    rsvpCounts,
    attendees,
    engagementCounts,
    recentActivity,
    participantEngagement,
    tiers,
  });
};
