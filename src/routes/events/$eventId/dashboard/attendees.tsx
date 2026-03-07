import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Input } from "~/components/ui/input";
import { Badge } from "~/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "~/components/ui/avatar";
import { Search } from "lucide-react";
import { useDashboard } from "./route";

export const Route = createFileRoute("/events/$eventId/dashboard/attendees")({
  component: AttendeesTab,
});

function AttendeesTab() {
  const ctx = useDashboard();
  if (!ctx) return null;
  const { data } = ctx;
  const { attendees } = data;
  const [search, setSearch] = useState("");

  const filteredAttendees = attendees.filter((a) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      a.displayName.toLowerCase().includes(q) ||
      (a.handle?.toLowerCase().includes(q) ?? false)
    );
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Attendees</h2>
        <p className="mt-1 text-muted-foreground">
          RSVP list ({attendees.length} total).
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
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium">Attendee</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-left font-medium">RSVP Date</th>
              </tr>
            </thead>
            <tbody>
              {filteredAttendees.map((a) => (
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
                    <Badge variant={a.status === "accepted" ? "default" : "secondary"}>
                      {a.status === "accepted" ? "Attending" : "Not attending"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {new Date(a.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
