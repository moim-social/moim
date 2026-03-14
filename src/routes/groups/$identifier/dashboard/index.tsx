import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "~/components/ui/button";
import { Alert, AlertDescription } from "~/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { MarkdownEditor } from "~/components/MarkdownEditor";
import {
  StatCard,
  StatsGrid,
  DashboardSection,
  PageHeader,
} from "~/components/dashboard";
import { useGroupDashboard, postGroupNoteFn } from "./route";

export const Route = createFileRoute("/groups/$identifier/dashboard/")({
  component: OverviewTab,
});

function OverviewTab() {
  const { data, refresh } = useGroupDashboard();
  const { group, members, events, engagementCounts } = data;

  const now = new Date();
  const upcomingEvents = events.filter((e) => new Date(e.startsAt) >= now);
  const pastEvents = events.filter((e) => new Date(e.startsAt) < now);

  const [noteDialogOpen, setNoteDialogOpen] = useState(false);
  const [noteContent, setNoteContent] = useState("");
  const [noteSubmitting, setNoteSubmitting] = useState(false);
  const [noteError, setNoteError] = useState("");

  async function submitNote() {
    setNoteSubmitting(true);
    setNoteError("");
    try {
      await postGroupNoteFn({ data: { groupActorId: group.id, content: noteContent } });
      setNoteContent("");
      setNoteDialogOpen(false);
      refresh();
    } catch (err) {
      setNoteError(err instanceof Error ? err.message : "Failed to post note");
    }
    setNoteSubmitting(false);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Overview"
        subtitle="Group insights and engagement summary."
        action={
          <Button variant="outline" size="sm" onClick={() => { setNoteDialogOpen(true); setNoteError(""); }}>
            Post Note
          </Button>
        }
      />

      <DashboardSection title="Insights">
        <StatsGrid>
          <StatCard label="Followers" value={group.followersCount} />
          <StatCard label="Members" value={members.length} />
          <StatCard label="Upcoming" value={upcomingEvents.length} suffix="events" />
          <StatCard label="Past" value={pastEvents.length} suffix="events" />
        </StatsGrid>
      </DashboardSection>

      <DashboardSection title="Engagement">
        <StatsGrid>
          <StatCard label="Reactions" value={engagementCounts.reactions} />
          <StatCard label="Boosts" value={engagementCounts.announces} />
          <StatCard label="Replies" value={engagementCounts.replies} />
          <StatCard label="Quotes" value={engagementCounts.quotes} />
        </StatsGrid>
      </DashboardSection>

      <Dialog open={noteDialogOpen} onOpenChange={setNoteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Post a Note</DialogTitle>
            <DialogDescription>
              Post an announcement from {group.name ?? `@${group.handle}`}. This will be delivered to all followers.
            </DialogDescription>
          </DialogHeader>
          {noteError && (
            <Alert variant="destructive">
              <AlertDescription>{noteError}</AlertDescription>
            </Alert>
          )}
          <MarkdownEditor value={noteContent} onChange={setNoteContent} rows={4} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setNoteDialogOpen(false)}>Cancel</Button>
            <Button onClick={submitNote} disabled={noteSubmitting || !noteContent.trim()}>
              {noteSubmitting ? "Posting..." : "Post"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
