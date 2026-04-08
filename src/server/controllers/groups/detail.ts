import { eq, and, isNull, sql, inArray } from "drizzle-orm";
import { db } from "~/server/db/client";
import { actors, users, groupMembers, events, follows, posts, groupPlaces, places, placeCategories, activityLogs } from "~/server/db/schema";
import { getSessionUser } from "~/server/auth";

export const GET = async ({ request }: { request: Request }) => {
  const url = new URL(request.url);
  const handle = url.searchParams.get("handle");

  if (!handle) {
    return Response.json({ error: "handle is required" }, { status: 400 });
  }

  // Find the group actor
  const [group] = await db
    .select()
    .from(actors)
    .where(and(eq(actors.handle, handle), eq(actors.type, "Group")))
    .limit(1);

  if (!group) {
    return Response.json({ error: "Group not found" }, { status: 404 });
  }

  // Get members with their actor info
  const members = await db
    .select({
      memberActorId: groupMembers.memberActorId,
      role: groupMembers.role,
      handle: actors.handle,
      name: actors.name,
      avatarUrl: sql<string | null>`COALESCE(${users.avatarUrl}, ${actors.avatarUrl})`,
      actorUrl: actors.actorUrl,
      isLocal: actors.isLocal,
    })
    .from(groupMembers)
    .innerJoin(actors, eq(groupMembers.memberActorId, actors.id))
    .leftJoin(users, eq(actors.userId, users.id))
    .where(eq(groupMembers.groupActorId, group.id));

  // Get events for this group
  const groupEvents = await db
    .select({
      id: events.id,
      title: events.title,
      description: events.description,
      categoryId: events.categoryId,
      startsAt: events.startsAt,
      endsAt: events.endsAt,
      timezone: events.timezone,
      location: events.location,
      createdAt: events.createdAt,
    })
    .from(events)
    .where(and(eq(events.groupActorId, group.id), eq(events.published, true), isNull(events.deletedAt)))
    .orderBy(events.startsAt);

  // Get followers with their actor info
  const followers = await db
    .select({
      handle: actors.handle,
      name: actors.name,
      avatarUrl: sql<string | null>`COALESCE(${users.avatarUrl}, ${actors.avatarUrl})`,
      actorUrl: actors.actorUrl,
      domain: actors.domain,
      isLocal: actors.isLocal,
    })
    .from(follows)
    .innerJoin(actors, eq(follows.followerId, actors.id))
    .leftJoin(users, eq(actors.userId, users.id))
    .where(and(eq(follows.followingId, group.id), eq(follows.status, "accepted")));

  // Get posts by this group actor
  const groupPosts = await db
    .select({
      id: posts.id,
      content: posts.content,
      published: posts.published,
    })
    .from(posts)
    .where(and(eq(posts.actorId, group.id), isNull(posts.eventId)))
    .orderBy(posts.published);

  // Get places assigned to this group
  const groupPlaceRows = await db
    .select({
      id: places.id,
      name: places.name,
      description: places.description,
      address: places.address,
      latitude: places.latitude,
      longitude: places.longitude,
      categorySlug: placeCategories.slug,
      categoryLabel: placeCategories.label,
      categoryEmoji: placeCategories.emoji,
    })
    .from(groupPlaces)
    .innerJoin(places, eq(groupPlaces.placeId, places.id))
    .leftJoin(placeCategories, eq(places.categoryId, placeCategories.slug))
    .where(eq(groupPlaces.groupActorId, group.id));

  // Engagement across all group events
  const eventIds = groupEvents.map((e) => e.id);
  let engagementCounts = { reactions: 0, announces: 0, replies: 0, quotes: 0 };
  let recentActivity: Array<{
    id: string;
    type: string;
    emoji: string | null;
    content: string | null;
    createdAt: Date;
    actorHandle: string;
    actorName: string | null;
    eventId: string | null;
    eventTitle: string | null;
  }> = [];

  if (eventIds.length > 0) {
    const engagementRows = await db
      .select({
        type: activityLogs.type,
        count: sql<number>`count(*)::int`,
      })
      .from(activityLogs)
      .where(inArray(activityLogs.eventId, eventIds))
      .groupBy(activityLogs.type);

    engagementCounts = {
      reactions: (engagementRows.find((r) => r.type === "like")?.count ?? 0) +
        (engagementRows.find((r) => r.type === "emoji_react")?.count ?? 0),
      announces: engagementRows.find((r) => r.type === "announce")?.count ?? 0,
      replies: engagementRows.find((r) => r.type === "reply")?.count ?? 0,
      quotes: engagementRows.find((r) => r.type === "quote")?.count ?? 0,
    };

    recentActivity = await db
      .select({
        id: activityLogs.id,
        type: activityLogs.type,
        emoji: activityLogs.emoji,
        content: activityLogs.content,
        createdAt: activityLogs.createdAt,
        actorHandle: actors.handle,
        actorName: actors.name,
        eventId: activityLogs.eventId,
        eventTitle: events.title,
      })
      .from(activityLogs)
      .innerJoin(actors, eq(activityLogs.actorId, actors.id))
      .leftJoin(events, eq(activityLogs.eventId, events.id))
      .where(inArray(activityLogs.eventId, eventIds))
      .orderBy(sql`${activityLogs.createdAt} DESC`)
      .limit(20);
  }

  // Check if the current user is a member (join through actors to match any actor for this user)
  let currentUserRole: string | null = null;
  const user = await getSessionUser(request);
  if (user) {
    const memberships = await db
      .select({ role: groupMembers.role })
      .from(groupMembers)
      .innerJoin(actors, eq(groupMembers.memberActorId, actors.id))
      .where(
        and(
          eq(groupMembers.groupActorId, group.id),
          eq(actors.userId, user.id),
          eq(actors.type, "Person"),
        ),
      );
    // Return highest-privilege role (owner > moderator)
    if (memberships.length > 0) {
      currentUserRole = memberships.some((m) => m.role === "owner") ? "owner" : memberships[0].role;
    }
  }

  return Response.json({
    group: {
      id: group.id,
      handle: group.handle,
      name: group.name,
      summary: group.summary,
      website: group.website,
      avatarUrl: group.avatarUrl,
      categories: group.categories,
      language: group.language,
      timezone: group.timezone,
      verified: group.verified,
      followersCount: followers.length,
      createdAt: group.createdAt,
    },
    members,
    followers,
    events: groupEvents,
    posts: groupPosts,
    places: groupPlaceRows.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      address: p.address,
      latitude: p.latitude,
      longitude: p.longitude,
      category: p.categorySlug
        ? { slug: p.categorySlug, label: p.categoryLabel, emoji: p.categoryEmoji }
        : null,
    })),
    engagementCounts,
    recentActivity,
    currentUserRole,
  });
};
