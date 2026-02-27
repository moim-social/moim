import { eq, and } from "drizzle-orm";
import { db } from "~/server/db/client";
import { actors, groupMembers, events, follows, posts } from "~/server/db/schema";
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
      role: groupMembers.role,
      handle: actors.handle,
      name: actors.name,
      actorUrl: actors.actorUrl,
      isLocal: actors.isLocal,
    })
    .from(groupMembers)
    .innerJoin(actors, eq(groupMembers.memberActorId, actors.id))
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
      location: events.location,
      createdAt: events.createdAt,
    })
    .from(events)
    .where(eq(events.groupActorId, group.id))
    .orderBy(events.startsAt);

  // Get followers with their actor info
  const followers = await db
    .select({
      handle: actors.handle,
      name: actors.name,
      actorUrl: actors.actorUrl,
      domain: actors.domain,
      isLocal: actors.isLocal,
    })
    .from(follows)
    .innerJoin(actors, eq(follows.followerId, actors.id))
    .where(and(eq(follows.followingId, group.id), eq(follows.status, "accepted")));

  // Get posts by this group actor
  const groupPosts = await db
    .select({
      id: posts.id,
      content: posts.content,
      published: posts.published,
    })
    .from(posts)
    .where(eq(posts.actorId, group.id))
    .orderBy(posts.published);

  // Check if the current user is a member (join through actors to match any actor for this user)
  let currentUserRole: string | null = null;
  const user = await getSessionUser(request);
  if (user) {
    const [membership] = await db
      .select({ role: groupMembers.role })
      .from(groupMembers)
      .innerJoin(actors, eq(groupMembers.memberActorId, actors.id))
      .where(
        and(
          eq(groupMembers.groupActorId, group.id),
          eq(actors.userId, user.id),
          eq(actors.type, "Person"),
        ),
      )
      .limit(1);
    currentUserRole = membership?.role ?? null;
  }

  return Response.json({
    group: {
      id: group.id,
      handle: group.handle,
      name: group.name,
      summary: group.summary,
      website: group.website,
      categories: group.categories,
      followersCount: followers.length,
      createdAt: group.createdAt,
    },
    members,
    followers,
    events: groupEvents,
    posts: groupPosts,
    currentUserRole,
  });
};
