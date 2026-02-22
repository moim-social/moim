import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";

interface ActorInfo {
  name?: string;
  handle: string;
  icon?: string;
  summary?: string;
  remoteFollowUrl?: string;
}

export function RemoteFollowDialog({ actorHandle }: { actorHandle: string }) {
  const [open, setOpen] = useState(false);
  const [fediverseId, setFediverseId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [actorInfo, setActorInfo] = useState<ActorInfo | null>(null);

  const handleLookup = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const input = fediverseId.trim();
    if (!input) {
      setError("Please enter your fediverse handle.");
      return;
    }

    if (!/^@?[^@]+@[^@]+\.[^@]+$/.test(input)) {
      setError("Invalid format. Use @username@domain.com");
      return;
    }

    setLoading(true);
    setError("");
    setActorInfo(null);

    try {
      const response = await fetch("/api/webfinger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fediverseId: input, actorHandle }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Lookup failed.");
      }
      if (!data.actor) {
        throw new Error("User not found.");
      }
      setActorInfo(data.actor);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lookup failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleFollow = () => {
    if (!actorInfo?.remoteFollowUrl) {
      setError("Subscribe template not found for this instance.");
      return;
    }
    window.open(actorInfo.remoteFollowUrl, "_blank", "noopener,noreferrer");
    setOpen(false);
  };

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) {
      setFediverseId("");
      setError("");
      setActorInfo(null);
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Remote Follow
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Remote Follow</DialogTitle>
          <DialogDescription>
            To follow <strong>@{actorHandle}</strong>, enter your fediverse handle.
          </DialogDescription>
        </DialogHeader>

        {!actorInfo ? (
          <form onSubmit={handleLookup} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fediverseId">Your fediverse handle</Label>
              <Input
                id="fediverseId"
                placeholder="@username@mastodon.social"
                value={fediverseId}
                onChange={(e) => {
                  setFediverseId(e.target.value);
                  if (error) setError("");
                }}
                disabled={loading}
              />
              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                type="button"
                variant="ghost"
                onClick={() => handleOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Looking up..." : "Look up"}
              </Button>
            </div>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-md border p-3">
              {actorInfo.icon && (
                <img
                  src={actorInfo.icon}
                  alt=""
                  className="size-10 rounded-full shrink-0"
                />
              )}
              <div className="min-w-0 flex-1">
                {actorInfo.name && (
                  <p className="font-medium truncate">{actorInfo.name}</p>
                )}
                <p className="text-sm text-muted-foreground truncate">
                  @{actorInfo.handle}
                </p>
              </div>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex gap-2 justify-end">
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setActorInfo(null);
                  setError("");
                }}
              >
                Back
              </Button>
              <Button onClick={handleFollow}>Follow</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
