import { type ReactNode, useState } from "react";
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

export function RemoteDiscussionDialog({
  apUrl,
  triggerLabel = "Discuss on your instance",
  variant = "button",
  className,
}: {
  apUrl: string;
  triggerLabel?: ReactNode;
  variant?: "button" | "link" | "ghost";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [handle, setHandle] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [interactionUrl, setInteractionUrl] = useState<string | null>(null);
  const [domain, setDomain] = useState<string | null>(null);

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    const input = handle.trim();
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

    try {
      const response = await fetch("/api/instance-lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handle: input }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Lookup failed.");
      }

      const url = data.interactionTemplate.replace(
        "{uri}",
        encodeURIComponent(apUrl),
      );
      setInteractionUrl(url);
      setDomain(data.domain);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lookup failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleGo = () => {
    if (!interactionUrl) return;
    window.open(interactionUrl, "_blank", "noopener,noreferrer");
    setOpen(false);
  };

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) {
      setHandle("");
      setError("");
      setInteractionUrl(null);
      setDomain(null);
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {variant === "link" ? (
          <button
            type="button"
            className={`text-xs text-muted-foreground hover:text-foreground hover:underline cursor-pointer ${className ?? ""}`}
          >
            {triggerLabel}
          </button>
        ) : variant === "ghost" ? (
          <Button variant="ghost" size="sm" className={`h-auto px-1.5 py-0.5 text-xs text-muted-foreground gap-1 ${className ?? ""}`}>
            {triggerLabel}
          </Button>
        ) : (
          <Button variant="outline" size="sm" className={className}>
            {triggerLabel}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Join the Discussion</DialogTitle>
          <DialogDescription>
            If you want to continue this discussion, enter your fediverse handle
            to find this post on your instance.
          </DialogDescription>
        </DialogHeader>

        {!interactionUrl ? (
          <form onSubmit={handleLookup} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="remoteDiscussHandle">
                Your fediverse handle
              </Label>
              <Input
                id="remoteDiscussHandle"
                placeholder="@username@mastodon.social"
                value={handle}
                onChange={(e) => {
                  setHandle(e.target.value);
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
            <p className="text-sm text-muted-foreground">
              You will be redirected to <strong>{domain}</strong> to find and
              reply to this post.
            </p>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex gap-2 justify-end">
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setInteractionUrl(null);
                  setDomain(null);
                  setError("");
                }}
              >
                Back
              </Button>
              <Button onClick={handleGo}>Go to my instance</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
