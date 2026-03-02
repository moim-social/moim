import { useState, useEffect } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "~/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "~/components/ui/tabs";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/admin/users/$userId")({
  component: AdminUserDetailPage,
});

type UserDetail = {
  id: string;
  handle: string;
  fediverseHandle: string | null;
  displayName: string;
  summary: string | null;
  avatarUrl: string | null;
  createdAt: string;
  updatedAt: string;
};

type SessionRow = {
  id: string;
  createdAt: string;
  expiresAt: string;
};

type GroupRow = {
  groupActorId: string;
  groupName: string | null;
  groupHandle: string;
  role: string;
  joinedAt: string;
};

type EventRow = {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string | null;
  groupName: string | null;
};

type CheckinRow = {
  id: string;
  placeName: string;
  placeId: string;
  note: string | null;
  createdAt: string;
};

function AdminUserDetailPage() {
  const { userId } = Route.useParams();
  const [user, setUser] = useState<UserDetail | null>(null);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [checkins, setCheckins] = useState<CheckinRow[]>([]);
  const [sessionCount, setSessionCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/admin/users/detail?id=${userId}`)
      .then((r) => r.json())
      .then((data) => {
        setUser(data.user ?? null);
        setSessions(data.sessions ?? []);
        setGroups(data.groups ?? []);
        setEvents(data.events ?? []);
        setCheckins(data.checkins ?? []);
        setSessionCount(data.sessionCount ?? 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [userId]);

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });

  const formatDatetime = (iso: string) =>
    new Date(iso).toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Loading user...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/admin/users">
            <ArrowLeft className="size-4 mr-1" />
            Back to Users
          </Link>
        </Button>
        <p className="text-muted-foreground">User not found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" asChild>
        <Link to="/admin/users">
          <ArrowLeft className="size-4 mr-1" />
          Back to Users
        </Link>
      </Button>

      {/* Profile Header */}
      <Card>
        <CardHeader>
          <div className="flex items-start gap-4">
            <Avatar size="lg" className="size-16">
              {user.avatarUrl ? (
                <AvatarImage src={user.avatarUrl} alt="" />
              ) : null}
              <AvatarFallback className="text-lg">
                {user.displayName.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <CardTitle className="text-xl">{user.displayName}</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {user.handle}
              </p>
              {user.fediverseHandle && (
                <p className="text-sm text-muted-foreground">
                  {user.fediverseHandle}
                </p>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {user.summary && (
            <p className="text-sm mb-4">{user.summary}</p>
          )}
          <div className="flex gap-6 text-xs text-muted-foreground">
            <span>Joined {formatDate(user.createdAt)}</span>
            <span>Updated {formatDate(user.updatedAt)}</span>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="sessions">
        <TabsList>
          <TabsTrigger value="sessions">
            Sessions ({sessionCount})
          </TabsTrigger>
          <TabsTrigger value="groups">
            Groups ({groups.length})
          </TabsTrigger>
          <TabsTrigger value="events">
            Events ({events.length})
          </TabsTrigger>
          <TabsTrigger value="checkins">
            Check-ins ({checkins.length})
          </TabsTrigger>
        </TabsList>

        {/* Sessions Tab */}
        <TabsContent value="sessions">
          {sessions.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">
              No sessions found.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border mt-2">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-3 text-left font-medium">
                      Session ID
                    </th>
                    <th className="px-4 py-3 text-left font-medium">
                      Created
                    </th>
                    <th className="px-4 py-3 text-left font-medium">
                      Expires
                    </th>
                    <th className="px-4 py-3 text-center font-medium">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((session) => {
                    const isExpired =
                      new Date(session.expiresAt) < new Date();
                    return (
                      <tr
                        key={session.id}
                        className="border-b last:border-0 hover:bg-muted/30"
                      >
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                          {session.id.slice(0, 8)}...
                        </td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">
                          {formatDatetime(session.createdAt)}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">
                          {formatDatetime(session.expiresAt)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {isExpired ? (
                            <Badge variant="secondary">Expired</Badge>
                          ) : (
                            <Badge>Active</Badge>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        {/* Groups Tab */}
        <TabsContent value="groups">
          {groups.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">
              No group memberships found.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border mt-2">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-3 text-left font-medium">Group</th>
                    <th className="px-4 py-3 text-center font-medium">Role</th>
                    <th className="px-4 py-3 text-left font-medium">Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {groups.map((group) => (
                    <tr
                      key={group.groupActorId}
                      className="border-b last:border-0 hover:bg-muted/30"
                    >
                      <td className="px-4 py-3">
                        <Link
                          to="/groups/$identifier"
                          params={{ identifier: `@${group.groupHandle}` }}
                          className="font-medium hover:underline"
                        >
                          {group.groupName ?? `@${group.groupHandle}`}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Badge variant="secondary">{group.role}</Badge>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {formatDate(group.joinedAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        {/* Events Tab */}
        <TabsContent value="events">
          {events.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">
              No events organized.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border mt-2">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-3 text-left font-medium">Title</th>
                    <th className="px-4 py-3 text-left font-medium">
                      Starts At
                    </th>
                    <th className="px-4 py-3 text-left font-medium">Group</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((event) => (
                    <tr
                      key={event.id}
                      className="border-b last:border-0 hover:bg-muted/30"
                    >
                      <td className="px-4 py-3">
                        <Link
                          to="/events/$eventId"
                          params={{ eventId: event.id }}
                          className="font-medium hover:underline"
                        >
                          {event.title}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {formatDatetime(event.startsAt)}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {event.groupName || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        {/* Check-ins Tab */}
        <TabsContent value="checkins">
          {checkins.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">
              No check-ins found.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border mt-2">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-3 text-left font-medium">Place</th>
                    <th className="px-4 py-3 text-left font-medium">Note</th>
                    <th className="px-4 py-3 text-left font-medium">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {checkins.map((checkin) => (
                    <tr
                      key={checkin.id}
                      className="border-b last:border-0 hover:bg-muted/30"
                    >
                      <td className="px-4 py-3">
                        <Link
                          to="/places/$placeId"
                          params={{ placeId: checkin.placeId }}
                          className="font-medium hover:underline"
                        >
                          {checkin.placeName}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs truncate max-w-[300px]">
                        {checkin.note || "—"}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {formatDatetime(checkin.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
