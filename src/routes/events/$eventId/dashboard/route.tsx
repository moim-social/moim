import { createFileRoute, Link, Outlet, redirect, useNavigate, useRouter, useRouterState } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { useState, useCallback } from "react";
import { useEventCategoryMap } from "~/hooks/useEventCategories";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import {
  LayoutDashboard,
  Users,
  Activity,
  Layers,
  ArrowLeft,
  ExternalLink,
  Pencil,
  Eye,
  EyeOff,
  MoreHorizontal,
  Trash2,
  MessageSquare,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "~/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "~/components/ui/dialog";
import { z } from "zod";
import { zodValidator } from "@tanstack/zod-adapter";
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

// ── Shared types ────────────────────────────────────────────────────────────

export type TierItem = {
  id?: string;
  name: string;
  sortOrder: number;
  opensAt: string;
  closesAt: string;
  rsvpCount: number;
};

export type DashboardData = {
  event: {
    id: string;
    title: string;
    description: string | null;
    categoryId: string | null;
    startsAt: string;
    endsAt: string | null;
    timezone: string | null;
    location: string | null;
    groupActorId: string | null;
    published: boolean;
    status: "upcoming" | "ongoing" | "ended";
    createdAt: string;
  };
  rsvpCounts: {
    accepted: number;
    declined: number;
    total: number;
  };
  attendees: Attendee[];
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
  }[];
  participantEngagement: ParticipantEngagement[];
  tiers: TierItem[];
  hasRsvps: boolean;
};

export type Attendee = {
  userId: string;
  handle: string | null;
  displayName: string;
  avatarUrl: string | null;
  status: string;
  tierName: string | null;
  createdAt: string;
};

export type ParticipantEngagement = {
  actorId: string;
  actorHandle: string;
  actorName: string | null;
  reactionCount: number;
  replyCount: number;
  announceCount: number;
  totalEngagement: number;
};

// ── Server function ─────────────────────────────────────────────────────────

const getDashboardData = createServerFn({ method: "GET" })
  .inputValidator(zodValidator(z.object({ eventId: z.string() })))
  .handler(async ({ data: { eventId } }) => {
    const request = getRequest();
    const user = await getSessionUser(request);
    if (!user) throw redirect({ to: "/events/$eventId", params: { eventId } });

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

    if (!event) throw redirect({ to: "/events/$eventId", params: { eventId } });

    // Access control
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
      if (!membership) throw redirect({ to: "/events/$eventId", params: { eventId } });
    } else {
      if (event.organizerId !== user.id) throw redirect({ to: "/events/$eventId", params: { eventId } });
    }

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
      total: rsvpCountRows.reduce((sum, c) => sum + c.count, 0),
    };

    const attendeeRows = await db
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
        opensAt: eventTiers.opensAt,
        closesAt: eventTiers.closesAt,
        sortOrder: eventTiers.sortOrder,
        rsvpCount: sql<number>`count(${rsvps.userId})::int`,
      })
      .from(eventTiers)
      .leftJoin(rsvps, eq(rsvps.tierId, eventTiers.id))
      .where(eq(eventTiers.eventId, eventId))
      .groupBy(eventTiers.id)
      .orderBy(eventTiers.sortOrder);

    const now = new Date();
    const status =
      new Date(event.startsAt) > now
        ? "upcoming"
        : event.endsAt && new Date(event.endsAt) < now
          ? "ended"
          : "ongoing";

    return {
      event: { ...event, status },
      rsvpCounts,
      attendees: attendeeRows,
      engagementCounts,
      recentActivity: recentActivityRows,
      participantEngagement: participantEngagementRows,
      tiers: tierRows,
      hasRsvps: rsvpCounts.accepted > 0,
    } as unknown as DashboardData;
  });

// ── Route ───────────────────────────────────────────────────────────────────

export const Route = createFileRoute("/events/$eventId/dashboard")({
  loader: async ({ params }) => {
    return getDashboardData({ data: { eventId: params.eventId } });
  },
  pendingComponent: () => <p className="text-muted-foreground p-6">Loading...</p>,
  component: DashboardLayout,
});

// ── Hook for child routes ───────────────────────────────────────────────────

export function useDashboard() {
  const data = Route.useLoaderData();
  const router = useRouter();
  const { eventId } = Route.useParams();

  const refresh = useCallback(() => {
    router.invalidate();
  }, [router]);

  return { data, refresh, eventId };
}

// ── Layout ──────────────────────────────────────────────────────────────────

type NavItem = { to: string; icon: typeof LayoutDashboard; label: string; exact?: boolean };

function DashboardLayout() {
  const { categoryMap } = useEventCategoryMap();
  const { eventId } = Route.useParams();
  const routerState = useRouterState();
  const currentPath = routerState.location.pathname;
  const data = Route.useLoaderData();

  const [publishing, setPublishing] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const router = useRouter();
  const navigate = useNavigate();

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/events/${eventId}`, { method: "DELETE" });
      if (res.ok) {
        navigate({ to: "/events" });
      }
    } catch {
      // ignore
    }
    setDeleting(false);
  }

  async function handleTogglePublish() {
    setPublishing(true);
    try {
      const res = await fetch(`/api/events/${eventId}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ published: !data.event.published }),
      });
      if (res.ok) {
        router.invalidate();
      }
    } catch {
      // ignore
    }
    setPublishing(false);
  }

  const { event } = data;

  const statusVariant = {
    upcoming: "default" as const,
    ongoing: "default" as const,
    ended: "secondary" as const,
  };

  const isGroupEvent = !!event.groupActorId;
  const basePath = `/events/${eventId}/dashboard`;
  const NAV_ITEMS: NavItem[] = [
    { to: basePath, icon: LayoutDashboard, label: "Overview", exact: true },
    { to: `${basePath}/attendees`, icon: Users, label: "Attendees" },
    ...(isGroupEvent
      ? [
          { to: `${basePath}/tiers`, icon: Layers, label: "Ticket Management" },
          { to: `${basePath}/discussions`, icon: MessageSquare, label: "Discussions" },
          { to: `${basePath}/activity`, icon: Activity, label: "Activity" },
        ]
      : []),
    { to: `${basePath}/edit`, icon: Pencil, label: "Edit Event" },
  ];

  return (
    <div className="-mx-6 -my-8 flex min-h-[calc(100vh-3.5rem)]">
      {/* Sidebar */}
      <aside className="flex w-56 shrink-0 flex-col border-r bg-muted/30">
        <div className="border-b p-4">
          <Link
            to="/events/$eventId"
            params={{ eventId }}
            className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            Back to Event
          </Link>
          <h1 className="mt-3 text-base font-semibold truncate" title={event.title}>
            {event.title}
          </h1>
          <div className="mt-1.5 flex items-center gap-1.5">
            <Badge variant={statusVariant[event.status]} className="text-xs">
              {event.status}
            </Badge>
            {!event.published && (
              <Badge variant="outline" className="text-xs">
                Draft
              </Badge>
            )}
            {event.categoryId && categoryMap.has(event.categoryId) && (
              <Badge variant="outline" className="text-xs">
                {categoryMap.get(event.categoryId)}
              </Badge>
            )}
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">
            {new Date(event.startsAt).toLocaleDateString(undefined, {
              weekday: "short",
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
          {isGroupEvent && (
            <Button
              variant={event.published ? "outline" : "default"}
              size="sm"
              className="mt-3 w-full text-xs"
              disabled={publishing}
              onClick={handleTogglePublish}
            >
              {event.published ? (
                <>
                  <EyeOff className="size-3.5 mr-1.5" />
                  {publishing ? "Unpublishing..." : "Unpublish"}
                </>
              ) : (
                <>
                  <Eye className="size-3.5 mr-1.5" />
                  {publishing ? "Publishing..." : "Publish"}
                </>
              )}
            </Button>
          )}
        </div>

        <nav className="flex-1 space-y-0.5 p-3">
          {NAV_ITEMS.map((item) => {
            const isActive = item.exact
              ? currentPath === item.to
              : currentPath.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors ${
                  isActive
                    ? "bg-accent font-medium text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                }`}
              >
                <item.icon className="size-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t p-3 space-y-1">
          <Link
            to="/events/$eventId"
            params={{ eventId }}
            className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground"
          >
            <ExternalLink className="size-4" />
            Public Page
          </Link>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground"
              >
                <MoreHorizontal className="size-4" />
                More Actions
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" side="top">
              <DropdownMenuItem
                disabled={data.hasRsvps}
                onClick={() => setShowDeleteDialog(true)}
                className="text-destructive focus:text-destructive"
                title={data.hasRsvps ? "Cannot delete event with RSVPs" : undefined}
              >
                <Trash2 className="size-4" />
                Delete Event
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      {/* Delete confirmation dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Event</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this event? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleting}
              onClick={handleDelete}
            >
              {deleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        <Outlet />
      </div>
    </div>
  );
}
