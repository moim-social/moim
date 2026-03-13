import { useState, useEffect, useRef } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Badge } from "~/components/ui/badge";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/admin/events/")({
  component: AdminEventsPage,
});

type EventRow = {
  id: string;
  title: string;
  startsAt: string;
  published: boolean;
  priority: number;
  deletedAt: string | null;
  createdAt: string;
  organizerDisplayName: string;
  groupHandle: string | null;
  groupName: string | null;
  categoryLabel: string | null;
  country: string | null;
};

const LIMIT = 50;

function AdminEventsPage() {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const [editingPriority, setEditingPriority] = useState<
    Record<string, string>
  >({});
  const [saving, setSaving] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchEvents = (q: string, off: number) => {
    setLoading(true);
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    params.set("limit", String(LIMIT));
    params.set("offset", String(off));
    fetch(`/api/admin/events?${params}`)
      .then((r) => r.json())
      .then((data) => {
        setEvents(data.events ?? []);
        setTotal(data.total ?? 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setOffset(0);
      fetchEvents(search, 0);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search]);

  useEffect(() => {
    fetchEvents(search, offset);
  }, [offset]);

  async function savePriority(eventId: string) {
    const raw = editingPriority[eventId];
    if (raw === undefined) return;
    const newPriority = parseInt(raw, 10) || 0;

    const prev = events.find((e) => e.id === eventId);
    if (!prev || prev.priority === newPriority) {
      setEditingPriority((p) => {
        const next = { ...p };
        delete next[eventId];
        return next;
      });
      return;
    }

    setSaving(eventId);
    // Optimistic update
    setEvents((prev) =>
      prev.map((e) =>
        e.id === eventId ? { ...e, priority: newPriority } : e,
      ),
    );

    try {
      const res = await fetch(`/api/admin/events/${eventId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priority: newPriority }),
      });
      if (!res.ok) {
        // Revert on failure
        setEvents((prev) =>
          prev.map((e) =>
            e.id === eventId
              ? { ...e, priority: prev.find((x) => x.id === eventId)?.priority ?? 0 }
              : e,
          ),
        );
      }
    } catch {
      // Revert on error
      if (prev) {
        setEvents((list) =>
          list.map((e) =>
            e.id === eventId ? { ...e, priority: prev.priority } : e,
          ),
        );
      }
    }
    setSaving(null);
    setEditingPriority((p) => {
      const next = { ...p };
      delete next[eventId];
      return next;
    });
  }

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });

  function statusBadge(event: EventRow) {
    if (event.deletedAt) return <Badge variant="destructive">Deleted</Badge>;
    if (event.published) return <Badge variant="default">Published</Badge>;
    return <Badge variant="secondary">Draft</Badge>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Events</h2>
        <p className="mt-1 text-muted-foreground">
          Manage event priority for banner discoverability.
        </p>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          placeholder="Search by title..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <p className="text-muted-foreground">Loading events...</p>
        </div>
      ) : events.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <p className="text-muted-foreground">
            {search ? "No events match your search." : "No events found."}
          </p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-left font-medium">Title</th>
                  <th className="px-4 py-3 text-left font-medium">Organizer</th>
                  <th className="px-4 py-3 text-left font-medium">Group</th>
                  <th className="px-4 py-3 text-left font-medium">Category</th>
                  <th className="px-4 py-3 text-left font-medium">Country</th>
                  <th className="px-4 py-3 text-left font-medium">Date</th>
                  <th className="px-4 py-3 text-center font-medium">Status</th>
                  <th className="px-4 py-3 text-center font-medium">Priority</th>
                </tr>
              </thead>
              <tbody>
                {events.map((event) => (
                  <tr
                    key={event.id}
                    className="border-b last:border-0 hover:bg-muted/30"
                  >
                    <td className="px-4 py-3">
                      <p
                        className={`font-medium truncate max-w-[250px] ${event.deletedAt ? "line-through text-muted-foreground" : ""}`}
                        title={event.title}
                      >
                        {event.title}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {event.organizerDisplayName}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {event.groupName ?? event.groupHandle ?? "\u2014"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {event.categoryLabel ?? "\u2014"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {event.country ?? "\u2014"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {formatDate(event.startsAt)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {statusBadge(event)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Input
                        type="number"
                        className="w-20 text-center mx-auto"
                        value={
                          editingPriority[event.id] ?? String(event.priority)
                        }
                        onChange={(e) =>
                          setEditingPriority((prev) => ({
                            ...prev,
                            [event.id]: e.target.value,
                          }))
                        }
                        onBlur={() => savePriority(event.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") savePriority(event.id);
                        }}
                        disabled={saving === event.id}
                        min={0}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Showing {offset + 1}&ndash;{Math.min(offset + LIMIT, total)} of{" "}
              {total}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={offset === 0}
                onClick={() => setOffset(Math.max(0, offset - LIMIT))}
              >
                <ChevronLeft className="size-4 mr-1" />
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={offset + LIMIT >= total}
                onClick={() => setOffset(offset + LIMIT)}
              >
                Next
                <ChevronRight className="size-4 ml-1" />
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
