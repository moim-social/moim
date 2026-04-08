import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { useDashboard } from "./route";
import { Button } from "~/components/ui/button";
import { Textarea } from "~/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "~/components/ui/dialog";
import { Globe, Lock, Megaphone, Send } from "lucide-react";
import { renderMarkdownOrHtml } from "~/lib/markdown";

export const Route = createFileRoute("/events/$eventId/dashboard/")({
  component: OverviewTab,
});

type NoticeItem = {
  id: string;
  postId: string;
  content: string;
  senderHandle: string;
  senderName: string | null;
  createdAt: string;
};

function OverviewTab() {
  const { data, eventId } = useDashboard();
  const { rsvpCounts, engagementCounts } = data;
  const isGroupEvent = !!data.event.groupActorId;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Overview</h2>
        <p className="mt-1 text-muted-foreground">
          Event insights{isGroupEvent ? " and engagement summary" : ""}.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Attending" value={rsvpCounts.accepted} />
        {rsvpCounts.waitlisted > 0 && (
          <StatCard label="Waitlisted" value={rsvpCounts.waitlisted} />
        )}
        <StatCard label="Total RSVPs" value={rsvpCounts.total} />
        {isGroupEvent && (
          <>
            <StatCard label="Reactions" value={engagementCounts.reactions} />
            <StatCard label="Boosts" value={engagementCounts.announces} />
            <StatCard label="Replies" value={engagementCounts.replies} />
            <StatCard label="Quotes" value={engagementCounts.quotes} />
          </>
        )}
      </div>

      <NoticesSection eventId={eventId} />
    </div>
  );
}

function NoticesSection({ eventId }: { eventId: string }) {
  const [notices, setNotices] = useState<NoticeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);

  const fetchNotices = useCallback(async () => {
    try {
      const res = await fetch(`/api/events/${eventId}/notices?eventId=${eventId}`);
      if (res.ok) {
        const data = await res.json();
        setNotices(data.notices ?? []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    fetchNotices();
  }, [fetchNotices]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Megaphone className="size-5 text-muted-foreground" />
          <h3 className="text-lg font-semibold">Notices</h3>
        </div>
        <Button size="sm" onClick={() => setDialogOpen(true)}>
          <Send className="size-3.5 mr-1.5" />
          Send Notice
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : notices.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No notices sent yet. Send a notice to notify attendees about important updates.
        </p>
      ) : (
        <div className="space-y-3">
          {notices.map((notice) => (
            <div key={notice.id} className="rounded-lg border p-4 space-y-2">
              <div
                className="prose prose-sm max-w-none dark:prose-invert"
                dangerouslySetInnerHTML={{ __html: renderMarkdownOrHtml(notice.content) }}
              />
              <div className="text-xs text-muted-foreground">
                {new Date(notice.createdAt).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      <ComposeNoticeDialog
        eventId={eventId}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSent={fetchNotices}
      />
    </div>
  );
}

function ComposeNoticeDialog({
  eventId,
  open,
  onOpenChange,
  onSent,
}: {
  eventId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSent: () => void;
}) {
  const [content, setContent] = useState("");
  const [visibility, setVisibility] = useState<"unlisted" | "direct">("unlisted");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSend() {
    if (!content.trim()) return;
    setSending(true);
    setError(null);

    try {
      const res = await fetch(`/api/events/${eventId}/notices`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: content.trim(), visibility }),
      });

      if (res.ok) {
        setContent("");
        onOpenChange(false);
        onSent();
      } else {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? "Failed to send notice");
      }
    } catch {
      setError("Failed to send notice");
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Send Notice to Attendees</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            This notice will be posted from the event&apos;s group account and delivered
            directly to each attendee&apos;s fediverse inbox.
          </p>
          <p className="text-xs text-amber-600 dark:text-amber-400">
            Misskey users may not receive notifications unless they follow the group
            account or change their notification settings to allow mentions from all users.
          </p>
          <Textarea
            placeholder="Write your notice (markdown supported)..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={5}
            disabled={sending}
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setVisibility("unlisted")}
              disabled={sending}
              className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs transition-colors ${
                visibility === "unlisted"
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:bg-accent"
              }`}
            >
              <Globe className="size-3.5" />
              Unlisted
            </button>
            <button
              type="button"
              onClick={() => setVisibility("direct")}
              disabled={sending}
              className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs transition-colors ${
                visibility === "direct"
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:bg-accent"
              }`}
            >
              <Lock className="size-3.5" />
              Mentioned only
            </button>
          </div>
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={sending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSend}
            disabled={sending || !content.trim()}
          >
            {sending ? "Sending..." : "Send Notice"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border p-4 space-y-2">
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <p className="text-3xl font-bold">{value}</p>
    </div>
  );
}
