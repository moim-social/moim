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

export interface DashboardEvent {
  id: string;
  title: string;
  description: string | null;
  categoryId: string | null;
  startsAt: Date;
  endsAt: Date | null;
  location: string | null;
  timezone: string | null;
  organizerId: string;
  groupActorId: string | null;
  published: boolean;
  createdAt: Date;
  status: "upcoming" | "ongoing" | "ended";
}

export interface RsvpCounts {
  accepted: number;
  declined: number;
  waitlisted: number;
  total: number;
}

export interface Attendee {
  rsvpId: string;
  userId: string | null;
  isAnonymous: boolean;
  handle: string | null;
  displayName: string;
  avatarUrl: string | null;
  email: string | null;
  phone: string | null;
  status: string;
  tierName: string | null;
  createdAt: Date;
}

export interface EngagementCounts {
  reactions: number;
  announces: number;
  replies: number;
  quotes: number;
}

export interface RecentActivity {
  id: string;
  type: string;
  emoji: string | null;
  content: string | null;
  createdAt: Date;
  actorHandle: string;
  actorName: string | null;
}

export interface ParticipantEngagement {
  actorId: string;
  actorHandle: string;
  actorName: string | null;
  reactionCount: number;
  replyCount: number;
  announceCount: number;
  totalEngagement: number;
}

export interface TierItem {
  id: string;
  name: string;
  description: string | null;
  price: string | null;
  priceAmount: number | null;
  opensAt: Date | null;
  closesAt: Date | null;
  capacity: number | null;
  sortOrder: number;
  acceptedCount: number;
  waitlistedCount: number;
}

export interface DashboardData {
  event: DashboardEvent;
  rsvpCounts: RsvpCounts;
  attendees: Attendee[];
  engagementCounts: EngagementCounts;
  recentActivity: RecentActivity[];
  participantEngagement: ParticipantEngagement[];
  tiers: TierItem[];
  hasRsvps: boolean;
}

export type DashboardAccess =
  | { allowed: false; reason: "not_found" | "forbidden" }
  | { allowed: true };

export async function checkDashboardAccess(
  eventId: string,
  userId: string,
): Promise<{ allowed: boolean; event?: { organizerId: string; groupActorId: string | null } }> {
  const [event] = await db
    .select({
      organizerId: events.organizerId,
      groupActorId: events.groupActorId,
    })
    .from(events)
    .where(eq(events.id, eventId))
    .limit(1);

  if (!event) return { allowed: false };

  if (event.groupActorId) {
    const [membership] = await db
      .select({ role: groupMembers.role })
      .from(groupMembers)
      .innerJoin(actors, eq(groupMembers.memberActorId, actors.id))
      .where(
        and(
          eq(groupMembers.groupActorId, event.groupActorId),
          eq(actors.userId, userId),
          eq(actors.type, "Person"),
        ),
      )
      .limit(1);
    if (!membership) return { allowed: false };
  } else {
    if (event.organizerId !== userId) return { allowed: false };
  }

  return { allowed: true };
}

export async function getDashboardData(eventId: string): Promise<DashboardData | null> {
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

  if (!event) return null;

  const rsvpCountRows = await db
    .select({
      status: rsvps.status,
      count: sql<number>`count(*)::int`,
    })
    .from(rsvps)
    .where(eq(rsvps.eventId, eventId))
    .groupBy(rsvps.status);

  const rsvpCounts: RsvpCounts = {
    accepted: rsvpCountRows.find((c) => c.status === "accepted")?.count ?? 0,
    declined: rsvpCountRows.find((c) => c.status === "declined")?.count ?? 0,
    waitlisted: rsvpCountRows.find((c) => c.status === "waitlisted")?.count ?? 0,
    total: rsvpCountRows.reduce((sum, c) => sum + c.count, 0),
  };

  const attendeeRows = await db
    .select({
      rsvpId: rsvps.id,
      userId: rsvps.userId,
      status: rsvps.status,
      createdAt: rsvps.createdAt,
      handle: userFediverseAccounts.fediverseHandle,
      userDisplayName: users.displayName,
      avatarUrl: users.avatarUrl,
      tierName: eventTiers.name,
      anonDisplayName: rsvps.displayName,
      anonEmail: rsvps.email,
      anonPhone: rsvps.phone,
    })
    .from(rsvps)
    .leftJoin(users, eq(rsvps.userId, users.id))
    .leftJoin(userFediverseAccounts, and(
      eq(userFediverseAccounts.userId, users.id),
      eq(userFediverseAccounts.isPrimary, true),
    ))
    .leftJoin(eventTiers, eq(rsvps.tierId, eventTiers.id))
    .where(eq(rsvps.eventId, eventId));

  const engagementRows = await db
    .select({
      type: activityLogs.type,
      count: sql<number>`count(*)::int`,
    })
    .from(activityLogs)
    .where(eq(activityLogs.eventId, eventId))
    .groupBy(activityLogs.type);

  const engagementCounts: EngagementCounts = {
    reactions: (engagementRows.find((r) => r.type === "like")?.count ?? 0) +
      (engagementRows.find((r) => r.type === "emoji_react")?.count ?? 0),
    announces: engagementRows.find((r) => r.type === "announce")?.count ?? 0,
    replies: engagementRows.find((r) => r.type === "reply")?.count ?? 0,
    quotes: engagementRows.find((r) => r.type === "quote")?.count ?? 0,
  };

  const recentActivityRows = await db
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

  const participantEngagementRows = await db
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

  const tierRows = await db
    .select({
      id: eventTiers.id,
      name: eventTiers.name,
      description: eventTiers.description,
      price: eventTiers.price,
      priceAmount: eventTiers.priceAmount,
      opensAt: eventTiers.opensAt,
      closesAt: eventTiers.closesAt,
      capacity: eventTiers.capacity,
      sortOrder: eventTiers.sortOrder,
      acceptedCount: sql<number>`count(${rsvps.id}) filter (where ${rsvps.status} = 'accepted')::int`,
      waitlistedCount: sql<number>`count(${rsvps.id}) filter (where ${rsvps.status} = 'waitlisted')::int`,
    })
    .from(eventTiers)
    .leftJoin(rsvps, eq(rsvps.tierId, eventTiers.id))
    .where(eq(eventTiers.eventId, eventId))
    .groupBy(eventTiers.id)
    .orderBy(eventTiers.sortOrder);

  const now = new Date();
  const status: DashboardEvent["status"] =
    new Date(event.startsAt) > now
      ? "upcoming"
      : event.endsAt && new Date(event.endsAt) < now
        ? "ended"
        : "ongoing";

  return {
    event: { ...event, status },
    rsvpCounts,
    attendees: attendeeRows.map((r) => ({
      rsvpId: r.rsvpId,
      userId: r.userId,
      isAnonymous: r.userId === null,
      handle: r.handle,
      displayName: r.userDisplayName ?? r.anonDisplayName ?? "Anonymous",
      avatarUrl: r.avatarUrl,
      email: r.anonEmail,
      phone: r.anonPhone,
      status: r.status,
      tierName: r.tierName,
      createdAt: r.createdAt,
    })),
    engagementCounts,
    recentActivity: recentActivityRows,
    participantEngagement: participantEngagementRows,
    tiers: tierRows,
    hasRsvps: rsvpCounts.accepted > 0,
  };
}
