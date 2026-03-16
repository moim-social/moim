import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Input } from "~/components/ui/input";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "~/components/ui/avatar";
import { Search } from "lucide-react";
import { useDashboard } from "./route";

export const Route = createFileRoute("/events/$eventId/dashboard/attendees")({
  component: AttendeesTab,
});

function AttendeesTab() {
  const { data, eventId, refresh } = useDashboard();
  const { attendees } = data;
  const [search, setSearch] = useState("");
  const [managingUserId, setManagingUserId] = useState<string | null>(null);

  const filteredAttendees = attendees.filter((a) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      a.displayName.toLowerCase().includes(q) ||
      (a.handle?.toLowerCase().includes(q) ?? false)
    );
  });

  const accepted = filteredAttendees.filter((a) => a.status === "accepted");
  const waitlisted = filteredAttendees.filter((a) => a.status === "waitlisted");
  const declined = filteredAttendees.filter((a) => a.status === "declined");

  async function handleStatusChange(userId: string, newStatus: "accepted" | "waitlisted") {
    setManagingUserId(userId);
    try {
      const res = await fetch(`/api/events/${eventId}/rsvps/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        refresh();
      }
    } catch {
      // ignore
    }
    setManagingUserId(null);
  }

  function statusBadge(status: string) {
    if (status === "accepted") return <Badge variant="default">Attending</Badge>;
    if (status === "waitlisted") return <Badge variant="outline">Waitlisted</Badge>;
    return <Badge variant="secondary">Not attending</Badge>;
  }

  function AttendeeRow({ a, showActions }: { a: (typeof attendees)[0]; showActions?: "promote" | "demote" }) {
    return (
      <tr key={a.userId} className="border-b last:border-0 hover:bg-muted/30">
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            <Avatar className="size-8">
              {a.avatarUrl && <AvatarImage src={a.avatarUrl} />}
              <AvatarFallback className="text-xs">
                {a.displayName.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <div>
                <span className="font-medium">{a.displayName}</span>
                {a.handle && (
                  <span className="text-muted-foreground ml-1.5 text-xs">
                    @{a.handle}
                  </span>
                )}
              </div>
              {a.tierName && (
                <span className="text-xs text-muted-foreground">{a.tierName}</span>
              )}
            </div>
          </div>
        </td>
        <td className="px-4 py-3">
          {statusBadge(a.status)}
        </td>
        <td className="px-4 py-3 text-muted-foreground text-xs">
          {new Date(a.createdAt).toLocaleDateString()}
        </td>
        <td className="px-4 py-3">
          {showActions === "promote" && (
            <Button
              size="sm"
              variant="outline"
              disabled={managingUserId === a.userId}
              onClick={() => handleStatusChange(a.userId, "accepted")}
            >
              {managingUserId === a.userId ? "..." : "Promote"}
            </Button>
          )}
          {showActions === "demote" && (
            <Button
              size="sm"
              variant="ghost"
              disabled={managingUserId === a.userId}
              onClick={() => handleStatusChange(a.userId, "waitlisted")}
            >
              {managingUserId === a.userId ? "..." : "Move to Waitlist"}
            </Button>
          )}
        </td>
      </tr>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Attendees</h2>
        <p className="mt-1 text-muted-foreground">
          {accepted.length} attending
          {waitlisted.length > 0 && ` · ${waitlisted.length} waitlisted`}
          {declined.length > 0 && ` · ${declined.length} declined`}
        </p>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          placeholder="Search attendees..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {filteredAttendees.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">
          {search ? "No attendees match your search." : "No RSVPs yet."}
        </p>
      ) : (
        <div className="space-y-6">
          {/* Attending section */}
          {accepted.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-2">Attending ({accepted.length})</h3>
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-4 py-3 text-left font-medium">Attendee</th>
                      <th className="px-4 py-3 text-left font-medium">Status</th>
                      <th className="px-4 py-3 text-left font-medium">RSVP Date</th>
                      <th className="px-4 py-3 text-left font-medium w-36"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {accepted.map((a) => (
                      <AttendeeRow key={a.userId} a={a} showActions="demote" />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Waitlisted section */}
          {waitlisted.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-2">Waitlisted ({waitlisted.length})</h3>
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-4 py-3 text-left font-medium">Attendee</th>
                      <th className="px-4 py-3 text-left font-medium">Status</th>
                      <th className="px-4 py-3 text-left font-medium">RSVP Date</th>
                      <th className="px-4 py-3 text-left font-medium w-36"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {waitlisted.map((a) => (
                      <AttendeeRow key={a.userId} a={a} showActions="promote" />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Declined section */}
          {declined.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-2">Declined ({declined.length})</h3>
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-4 py-3 text-left font-medium">Attendee</th>
                      <th className="px-4 py-3 text-left font-medium">Status</th>
                      <th className="px-4 py-3 text-left font-medium">RSVP Date</th>
                      <th className="px-4 py-3 text-left font-medium w-36"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {declined.map((a) => (
                      <AttendeeRow key={a.userId} a={a} />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
