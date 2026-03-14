import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Alert, AlertDescription } from "~/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import {
  EmptyState,
  GaugeBar,
  PageHeader,
} from "~/components/dashboard";
import { useGroupDashboard } from "./route";

export const Route = createFileRoute("/groups/$identifier/dashboard/polls")({
  component: PollsTab,
});

function PollsTab() {
  const { data, refresh } = useGroupDashboard();
  const { group, pollsData } = data;
  const handle = group.handle;

  const [pollDialogOpen, setPollDialogOpen] = useState(false);
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollType, setPollType] = useState<"single" | "multiple">("single");
  const [pollOptions, setPollOptions] = useState(["", ""]);
  const [pollExpiresIn, setPollExpiresIn] = useState("");
  const [pollSubmitting, setPollSubmitting] = useState(false);
  const [pollError, setPollError] = useState("");

  async function submitPoll() {
    setPollSubmitting(true);
    setPollError("");
    try {
      const validOptions = pollOptions.filter((o) => o.trim());
      if (validOptions.length < 2) {
        setPollError("At least 2 options are required");
        setPollSubmitting(false);
        return;
      }
      const expiresAt = pollExpiresIn
        ? new Date(Date.now() + parseInt(pollExpiresIn, 10) * 3600_000).toISOString()
        : undefined;
      const res = await fetch(`/api/groups/${group.id}/polls`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: pollQuestion,
          type: pollType,
          options: validOptions,
          expiresAt,
        }),
      });
      const result = await res.json();
      if (!res.ok) {
        setPollError(result.error ?? "Failed to create poll");
        setPollSubmitting(false);
        return;
      }
      setPollQuestion("");
      setPollType("single");
      setPollOptions(["", ""]);
      setPollExpiresIn("");
      setPollDialogOpen(false);
      refresh();
    } catch {
      setPollError("Network error");
    }
    setPollSubmitting(false);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <PageHeader
          title="Polls"
          subtitle="Create and manage community polls."
        />
        <Button
          size="sm"
          onClick={() => {
            setPollDialogOpen(true);
            setPollError("");
          }}
        >
          Create Poll
        </Button>
      </div>

      {pollsData.length === 0 ? (
        <EmptyState message="No polls yet. Create one to engage your community." />
      ) : (
        <div className="space-y-4">
          {pollsData.map((poll) => {
            const totalVotes = poll.options.reduce((s, o) => s + o.count, 0);
            const isExpired =
              poll.expiresAt &&
              new Date(poll.expiresAt).getTime() < Date.now();
            return (
              <div
                key={poll.id}
                className="rounded-lg border p-4 space-y-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">{poll.question}</p>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Badge variant="secondary" className="text-xs">
                      {poll.type === "single"
                        ? "Single choice"
                        : "Multiple choice"}
                    </Badge>
                    {(poll.closed || isExpired) && (
                      <Badge variant="outline" className="text-xs">
                        Closed
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="space-y-2.5">
                  {poll.options.map((option, i) => (
                    <GaugeBar
                      key={option.id}
                      label={option.label}
                      count={option.count}
                      total={totalVotes}
                      colorIndex={i}
                    />
                  ))}
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    {poll.totalVoters} voter
                    {poll.totalVoters !== 1 ? "s" : ""}
                  </span>
                  <span>
                    {new Date(poll.createdAt).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })}
                    {poll.expiresAt && !poll.closed && !isExpired && (
                      <>
                        {" "}
                        &middot; expires{" "}
                        {new Date(poll.expiresAt).toLocaleDateString(
                          undefined,
                          {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          },
                        )}
                      </>
                    )}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Poll Dialog */}
      <Dialog open={pollDialogOpen} onOpenChange={setPollDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create a Poll</DialogTitle>
            <DialogDescription>
              Create a poll for {group.name ?? `@${handle}`}. It will be
              delivered to all followers.
            </DialogDescription>
          </DialogHeader>

          {pollError && (
            <Alert variant="destructive">
              <AlertDescription>{pollError}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="poll-question">Question</Label>
              <Input
                id="poll-question"
                value={pollQuestion}
                onChange={(e) => setPollQuestion(e.target.value)}
                placeholder="What would you like to ask?"
              />
            </div>

            <div className="space-y-2">
              <Label>Type</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={pollType === "single" ? "default" : "outline"}
                  onClick={() => setPollType("single")}
                >
                  Single choice
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={pollType === "multiple" ? "default" : "outline"}
                  onClick={() => setPollType("multiple")}
                >
                  Multiple choice
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Options</Label>
              {pollOptions.map((opt, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    value={opt}
                    onChange={(e) => {
                      const next = [...pollOptions];
                      next[i] = e.target.value;
                      setPollOptions(next);
                    }}
                    placeholder={`Option ${i + 1}`}
                  />
                  {pollOptions.length > 2 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setPollOptions(pollOptions.filter((_, j) => j !== i))
                      }
                    >
                      &times;
                    </Button>
                  )}
                </div>
              ))}
              {pollOptions.length < 20 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setPollOptions([...pollOptions, ""])}
                >
                  + Add option
                </Button>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="poll-expires">
                Expires in (hours, optional)
              </Label>
              <Input
                id="poll-expires"
                type="number"
                min="1"
                value={pollExpiresIn}
                onChange={(e) => setPollExpiresIn(e.target.value)}
                placeholder="e.g. 24"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPollDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={submitPoll}
              disabled={
                pollSubmitting ||
                !pollQuestion.trim() ||
                pollOptions.filter((o) => o.trim()).length < 2
              }
            >
              {pollSubmitting ? "Creating..." : "Create Poll"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
