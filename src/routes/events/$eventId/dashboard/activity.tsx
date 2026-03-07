import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useDashboard } from "./route";

export const Route = createFileRoute("/events/$eventId/dashboard/activity")({
  component: ActivityTab,
});

type ActivityItem = {
  id: string;
  type: string;
  emoji: string | null;
  content: string | null;
  createdAt: string;
  actorId: string;
  actorHandle: string;
  actorName: string | null;
};

const ACTIVITY_PAGE_SIZE = 20;

function ActivityTab() {
  const { eventId } = Route.useParams();
  const navigate = useNavigate();
  const { data } = useDashboard();
  const isGroupEvent = !!data.event.groupActorId;

  const [items, setItems] = useState<ActivityItem[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<string | null>(null);

  const fetchActivity = useCallback(() => {
    if (!isGroupEvent) return;
    setLoading(true);
    const params = new URLSearchParams();
    params.set("limit", String(ACTIVITY_PAGE_SIZE));
    params.set("offset", String(offset));
    if (typeFilter) params.set("type", typeFilter);

    fetch(`/api/events/${eventId}/dashboard/activity?${params}`)
      .then((r) => r.json())
      .then((data) => {
        setItems(data.items ?? []);
        setTotal(data.total ?? 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [eventId, offset, typeFilter, isGroupEvent]);

  useEffect(() => {
    fetchActivity();
  }, [fetchActivity]);

  useEffect(() => {
    if (!isGroupEvent) {
      navigate({ to: "/events/$eventId/dashboard", params: { eventId }, replace: true });
    }
  }, [isGroupEvent, eventId, navigate]);

  if (!isGroupEvent) return null;

  const typeFilters: { key: string | null; label: string }[] = [
    { key: null, label: "All" },
    { key: "replies", label: "Replies" },
    { key: "reactions", label: "Reactions" },
    { key: "reposts", label: "Reposts" },
  ];

  const totalPages = Math.ceil(total / ACTIVITY_PAGE_SIZE);
  const currentPage = Math.floor(offset / ACTIVITY_PAGE_SIZE) + 1;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Activity</h2>
        <p className="mt-1 text-muted-foreground">
          Engagement timeline.
        </p>
      </div>

      <div className="flex gap-1">
        {typeFilters.map((f) => (
          <Button
            key={f.key ?? "all"}
            variant={typeFilter === f.key ? "default" : "outline"}
            size="sm"
            className="text-xs h-7 px-2.5"
            onClick={() => {
              setTypeFilter(f.key);
              setOffset(0);
            }}
          >
            {f.label}
          </Button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground py-8 text-center">
          Loading activity...
        </p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">
          No engagement activity found.
        </p>
      ) : (
        <Card>
          <CardContent className="pt-6">
            <ul className="space-y-2">
              {items.map((a) => (
                <li
                  key={a.id}
                  className="flex items-center gap-3 py-2 border-b last:border-b-0"
                >
                  <span className="text-lg">
                    {a.type === "like"
                      ? "\u2B50"
                      : a.type === "emoji_react"
                        ? a.emoji ?? "\u{1F600}"
                        : a.type === "announce"
                          ? "\u{1F501}"
                          : a.type === "quote"
                            ? "\u{1F4DD}"
                            : "\u{1F4AC}"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <span className="text-sm font-medium">
                      {a.actorName ?? a.actorHandle}
                    </span>
                    <span className="text-sm text-muted-foreground ml-1.5">
                      {a.type === "like"
                        ? "liked"
                        : a.type === "emoji_react"
                          ? `reacted with ${a.emoji}`
                          : a.type === "announce"
                            ? "boosted"
                            : a.type === "quote"
                              ? "quoted"
                              : "replied to"}
                    </span>
                    <span className="text-sm text-muted-foreground ml-1">
                      your post
                    </span>
                    {a.content && (a.type === "reply" || a.type === "quote") && (
                      <p
                        className="text-xs text-muted-foreground mt-1 line-clamp-2"
                        dangerouslySetInnerHTML={{ __html: a.content }}
                      />
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {new Date(a.createdAt).toLocaleString(undefined, {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {currentPage} of {totalPages} ({total} items)
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={offset === 0}
              onClick={() => setOffset(Math.max(0, offset - ACTIVITY_PAGE_SIZE))}
            >
              <ChevronLeft className="size-4 mr-1" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={offset + ACTIVITY_PAGE_SIZE >= total}
              onClick={() => setOffset(offset + ACTIVITY_PAGE_SIZE)}
            >
              Next
              <ChevronRight className="size-4 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
