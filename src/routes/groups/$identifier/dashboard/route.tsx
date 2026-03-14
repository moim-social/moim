import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { useCallback } from "react";
import { useRouter } from "@tanstack/react-router";
import { Badge } from "~/components/ui/badge";
import {
  LayoutDashboard,
  CalendarDays,
  MapPinned,
  Users,
  Activity,
  ExternalLink,
  Pencil,
  BarChart,
} from "lucide-react";
import {
  DashboardShell,
  DashboardSidebar,
} from "~/components/dashboard";
import type { NavSection } from "~/components/dashboard";
import { z } from "zod";
import { zodValidator } from "@tanstack/zod-adapter";
import { eq, and, isNull, sql, inArray } from "drizzle-orm";
import { db } from "~/server/db/client";
import {
  actors,
  groupMembers,
  events,
  follows,
  groupPlaces,
  places,
  placeCategories,
  activityLogs,
  polls,
  pollOptions as pollOptionsTable,
  pollVotes as pollVotesTable,
} from "~/server/db/schema";
import { getSessionUser } from "~/server/auth";
import type { PlaceCategorySummary } from "~/lib/place";

// ── Shared types ────────────────────────────────────────────────────────────

export type GroupData = {
  group: {
    id: string;
    handle: string;
    name: string | null;
    summary: string | null;
    website: string | null;
    avatarUrl: string | null;
    categories: string[] | null;
    language: string | null;
    followersCount: number;
    createdAt: string;
  };
  members: {
    role: string;
    handle: string;
    name: string | null;
    actorUrl: string;
    isLocal: boolean;
  }[];
  followers: {
    handle: string;
    name: string | null;
    actorUrl: string;
    domain: string | null;
    isLocal: boolean;
  }[];
  events: {
    id: string;
    title: string;
    description: string | null;
    categoryId: string;
    startsAt: string;
    endsAt: string | null;
    location: string | null;
    createdAt: string;
  }[];
  places: {
    id: string;
    name: string;
    description: string | null;
    address: string | null;
    latitude: string | null;
    longitude: string | null;
    category: PlaceCategorySummary | null;
  }[];
  engagementCounts: {
    reactions: number;
    announces: number;
    replies: number;
    quotes: number;
  };
  recentActivity: {
    id: string;
    type: string;
    emoji: string | null;
    content: string | null;
    createdAt: string;
    actorHandle: string;
    actorName: string | null;
    eventId: string | null;
    eventTitle: string | null;
  }[];
  currentUserRole: string | null;
  pollsData: PollData[];
};

export type PollData = {
  id: string;
  questionId: string;
  question: string;
  type: "single" | "multiple";
  closed: boolean;
  expiresAt: string | null;
  createdAt: string;
  options: { id: string; label: string; sortOrder: number; count: number }[];
  totalVoters: number;
};

// ── Server function ─────────────────────────────────────────────────────────

const getGroupDashboardData = createServerFn({ method: "GET" })
  .inputValidator(zodValidator(z.object({ handle: z.string() })))
  .handler(async ({ data: { handle } }) => {
    const request = getRequest();
    const user = await getSessionUser(request);

    // Find the group actor
    const [group] = await db
      .select()
      .from(actors)
      .where(and(eq(actors.handle, handle), eq(actors.type, "Group")))
      .limit(1);

    if (!group) throw redirect({ to: "/" });

    // Check membership
    let currentUserRole: string | null = null;
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

    if (!currentUserRole) {
      throw redirect({ to: "/groups/$identifier", params: { identifier: `@${handle}` } });
    }

    // Get members
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

    // Get published events
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
      .where(
        and(
          eq(events.groupActorId, group.id),
          eq(events.published, true),
          isNull(events.deletedAt),
        ),
      )
      .orderBy(events.startsAt);

    // Get followers
    const followerRows = await db
      .select({
        handle: actors.handle,
        name: actors.name,
        actorUrl: actors.actorUrl,
        domain: actors.domain,
        isLocal: actors.isLocal,
      })
      .from(follows)
      .innerJoin(actors, eq(follows.followerId, actors.id))
      .where(
        and(eq(follows.followingId, group.id), eq(follows.status, "accepted")),
      );

    // Get places
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
        reactions:
          (engagementRows.find((r) => r.type === "like")?.count ?? 0) +
          (engagementRows.find((r) => r.type === "emoji_react")?.count ?? 0),
        announces:
          engagementRows.find((r) => r.type === "announce")?.count ?? 0,
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

    // Get polls
    const pollRows = await db
      .select({
        id: polls.id,
        questionId: polls.questionId,
        question: polls.question,
        type: polls.type,
        closed: polls.closed,
        expiresAt: polls.expiresAt,
        createdAt: polls.createdAt,
      })
      .from(polls)
      .where(eq(polls.groupActorId, group.id))
      .orderBy(sql`${polls.createdAt} DESC`)
      .limit(50);

    const pollsData: PollData[] = [];
    for (const poll of pollRows) {
      const options = await db
        .select({
          id: pollOptionsTable.id,
          label: pollOptionsTable.label,
          sortOrder: pollOptionsTable.sortOrder,
          count: sql<number>`count(${pollVotesTable.id})::int`,
        })
        .from(pollOptionsTable)
        .leftJoin(pollVotesTable, eq(pollVotesTable.optionId, pollOptionsTable.id))
        .where(eq(pollOptionsTable.pollId, poll.id))
        .groupBy(pollOptionsTable.id)
        .orderBy(pollOptionsTable.sortOrder);

      const [voterCount] = await db
        .select({ count: sql<number>`count(distinct ${pollVotesTable.voterActorUrl})::int` })
        .from(pollVotesTable)
        .where(eq(pollVotesTable.pollId, poll.id));

      pollsData.push({
        ...poll,
        options,
        totalVoters: voterCount?.count ?? 0,
      } as unknown as PollData);
    }

    return {
      group: {
        id: group.id,
        handle: group.handle,
        name: group.name,
        summary: group.summary,
        website: group.website,
        avatarUrl: group.avatarUrl,
        categories: group.categories,
        language: group.language,
        followersCount: followerRows.length,
        createdAt: group.createdAt,
      },
      members,
      followers: followerRows,
      events: groupEvents,
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
      pollsData,
    } as unknown as GroupData;
  });

// ── Route ───────────────────────────────────────────────────────────────────

export const Route = createFileRoute("/groups/$identifier/dashboard")({
  loader: async ({ params }) => {
    const handle = params.identifier.replace(/^@/, "");
    return getGroupDashboardData({ data: { handle } });
  },
  pendingComponent: () => (
    <p className="text-muted-foreground p-6">Loading...</p>
  ),
  component: GroupDashboardLayout,
});

// ── Hook for child routes ───────────────────────────────────────────────────

export function useGroupDashboard() {
  const data = Route.useLoaderData();
  const router = useRouter();
  const { identifier } = Route.useParams();

  const refresh = useCallback(() => {
    router.invalidate();
  }, [router]);

  return { data, refresh, identifier };
}

// ── Layout ──────────────────────────────────────────────────────────────────

function GroupDashboardLayout() {
  const { data } = useGroupDashboard();
  const { identifier } = Route.useParams();
  const handle = identifier.replace(/^@/, "");
  const { group } = data;
  const basePath = `/groups/${identifier}/dashboard`;

  const sections: NavSection[] = [
    {
      items: [
        { to: basePath, icon: LayoutDashboard, label: "Overview", exact: true },
        { to: `${basePath}/events`, icon: CalendarDays, label: "Events" },
        { to: `${basePath}/polls`, icon: BarChart, label: "Polls" },
        { to: `${basePath}/places`, icon: MapPinned, label: "Places" },
        { to: `${basePath}/members`, icon: Users, label: "Members" },
        { to: `${basePath}/activity`, icon: Activity, label: "Activity" },
      ],
    },
  ];

  return (
    <DashboardShell
      sidebar={
        <DashboardSidebar
          backTo={`/groups/${identifier}`}
          backLabel="Back to Group"
          title={group.name ?? `@${handle}`}
          subtitle={`@${handle}`}
          headerExtra={
            <div className="mt-1.5 flex items-center gap-1.5">
              <Badge variant="outline" className="text-xs">
                {data.currentUserRole}
              </Badge>
            </div>
          }
          sections={sections}
          footer={
            <>
              <a
                href={`/groups/${identifier}`}
                className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground"
              >
                <ExternalLink className="size-4" />
                Public Page
              </a>
              <a
                href={`/groups/${identifier}/edit`}
                className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground"
              >
                <Pencil className="size-4" />
                Edit Group
              </a>
            </>
          }
        />
      }
    >
      <Outlet />
    </DashboardShell>
  );
}
