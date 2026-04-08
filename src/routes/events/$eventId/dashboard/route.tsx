import { createFileRoute, Link, Outlet, redirect, useNavigate, useRouter } from "@tanstack/react-router";
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
  ExternalLink,
  Pencil,
  Eye,
  EyeOff,
  MoreHorizontal,
  Trash2,
  MessageSquare,
} from "lucide-react";
import { DashboardShell, DashboardSidebar } from "~/components/dashboard";
import type { NavSection } from "~/components/dashboard";
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
import { getSessionUser } from "~/server/auth";
import {
  getDashboardData as fetchDashboardData,
  checkDashboardAccess,
} from "~/server/services/event-dashboard";

// ── Shared types ────────────────────────────────────────────────────────────

export type TierItem = {
  id?: string;
  name: string;
  description: string | null;
  price: string | null;
  priceAmount: number | null;
  sortOrder: number;
  opensAt: string;
  closesAt: string;
  capacity: number | null;
  acceptedCount: number;
  waitlistedCount: number;
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
    waitlisted: number;
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

    const access = await checkDashboardAccess(eventId, user.id);
    if (!access.allowed) throw redirect({ to: "/events/$eventId", params: { eventId } });

    const data = await fetchDashboardData(eventId);
    if (!data) throw redirect({ to: "/events/$eventId", params: { eventId } });

    return data as unknown as DashboardData;
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

function DashboardLayout() {
  const { categoryMap } = useEventCategoryMap();
  const { eventId } = Route.useParams();
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
  const sections: NavSection[] = [
    {
      items: [
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
      ],
    },
  ];

  return (
    <>
      <DashboardShell
        sidebar={({ onClose }) => (
          <DashboardSidebar
            backTo={`/events/${eventId}`}
            backLabel="Back to Event"
            title={event.title}
            headerExtra={
              <>
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
              </>
            }
            sections={sections}
            onClose={onClose}
            footer={
              <>
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
              </>
            }
          />
        )}
      >
        <Outlet />
      </DashboardShell>

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
    </>
  );
}
