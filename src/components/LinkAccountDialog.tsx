import { useEffect, useRef, useState } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Alert, AlertDescription } from "~/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";

type Phase = "handle" | "challenge" | "waiting" | "success" | "merge" | "error";

type MergePreview = {
  sourceUserId: string;
  preview: {
    checkins: number;
    events: number;
    accounts: string[];
  };
};

export function LinkAccountDialog({
  open,
  onOpenChange,
  onLinked,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLinked: () => void;
}) {
  const [phase, setPhase] = useState<Phase>("handle");
  const [handle, setHandle] = useState("");
  const [challengeId, setChallengeId] = useState("");
  const [expectedEmojis, setExpectedEmojis] = useState<string[]>([]);
  const [allEmojis, setAllEmojis] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [mergeData, setMergeData] = useState<MergePreview | null>(null);
  const [merging, setMerging] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function normalize(h: string): string {
    return h.startsWith("@") ? h.slice(1) : h;
  }

  function reset() {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setPhase("handle");
    setHandle("");
    setChallengeId("");
    setExpectedEmojis([]);
    setAllEmojis([]);
    setError("");
    setExpiresAt("");
    setMergeData(null);
    setMerging(false);
  }

  // Reset when dialog closes
  useEffect(() => {
    if (!open) reset();
  }, [open]);

  async function requestOtp() {
    setError("");
    const normalized = normalize(handle);
    try {
      const res = await fetch("/api/auth/otp-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handle: normalized }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to request OTP");
        return;
      }
      setChallengeId(data.challengeId);
      setExpectedEmojis(data.expectedEmojis);
      setAllEmojis(data.allEmojis);
      setExpiresAt(data.expiresAt);
      setPhase("challenge");
    } catch {
      setError("Network error");
    }
  }

  // Poll for OTP verification, then call link-account
  useEffect(() => {
    if (phase !== "waiting") return;

    const normalized = normalize(handle);

    const poll = async () => {
      try {
        const res = await fetch("/api/auth/otp-check", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ handle: normalized, challengeId }),
        });
        const data = await res.json();

        if (data.ok) {
          // OTP verified — now link the account
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          await linkAccount(normalized);
        } else if (data.error === "challenge expired") {
          setError("Challenge expired. Please try again.");
          setPhase("error");
        } else if (res.status !== 202) {
          setError(data.error ?? "Verification failed");
          setPhase("error");
        }
      } catch {
        setError("Network error");
        setPhase("error");
      }
    };

    poll();
    intervalRef.current = setInterval(poll, 3000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [phase, handle, challengeId]);

  async function linkAccount(normalized: string) {
    try {
      const res = await fetch("/api/auth/link-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handle: normalized, challengeId }),
      });
      const data = await res.json();
      if (data.ok) {
        setPhase("success");
        setTimeout(() => {
          onLinked();
          onOpenChange(false);
        }, 1500);
      } else if (data.mergeRequired) {
        setMergeData({
          sourceUserId: data.sourceUserId,
          preview: data.preview,
        });
        setPhase("merge");
      } else {
        setError(data.error ?? "Failed to link account");
        setPhase("error");
      }
    } catch {
      setError("Network error");
      setPhase("error");
    }
  }

  async function confirmMerge() {
    if (!mergeData) return;
    setMerging(true);
    setError("");
    try {
      const normalized = normalize(handle);
      const res = await fetch("/api/auth/merge-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          handle: normalized,
          challengeId,
          sourceUserId: mergeData.sourceUserId,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setPhase("success");
        setTimeout(() => {
          onLinked();
          onOpenChange(false);
        }, 1500);
      } else {
        setError(data.error ?? "Merge failed");
        setMerging(false);
      }
    } catch {
      setError("Network error");
      setMerging(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Link Fediverse Account</DialogTitle>
          <DialogDescription>
            Verify ownership via OTP to link another fediverse account.
          </DialogDescription>
        </DialogHeader>

        {error && phase === "handle" && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {phase === "handle" && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              requestOtp();
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="link-handle">Fediverse handle</Label>
              <Input
                id="link-handle"
                type="text"
                placeholder="@user@mastodon.social"
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                required
              />
            </div>
            <Button type="submit">Request OTP</Button>
          </form>
        )}

        {phase === "challenge" && (
          <div className="space-y-4">
            <p className="text-sm">
              A poll has been sent to your Fediverse account as a DM.
              Select the highlighted emojis in the poll, then click Verify.
            </p>
            <div className="grid grid-cols-3 gap-2">
              {allEmojis.map((emoji) => (
                <div
                  key={emoji}
                  className={
                    expectedEmojis.includes(emoji)
                      ? "text-3xl p-3 rounded-lg text-center bg-primary/20 ring-2 ring-primary"
                      : "text-3xl p-3 rounded-lg text-center bg-muted opacity-40"
                  }
                >
                  {emoji}
                </div>
              ))}
            </div>
            {expiresAt && (
              <p className="text-sm text-muted-foreground">
                Expires: {new Date(expiresAt).toLocaleTimeString()}
              </p>
            )}
            <div className="flex gap-3">
              <Button onClick={() => setPhase("waiting")}>Verify</Button>
              <Button variant="outline" onClick={() => { reset(); }}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {phase === "waiting" && (
          <div className="space-y-4">
            <p className="text-muted-foreground">
              Waiting for your poll response...
            </p>
            <Button variant="outline" onClick={() => { reset(); }}>
              Cancel
            </Button>
          </div>
        )}

        {phase === "merge" && mergeData && (
          <div className="space-y-4">
            <p className="text-sm">
              This account already belongs to another Moim identity.
              Merging will transfer all data to your current account.
            </p>
            <div className="rounded-md border p-3 space-y-1 text-sm">
              <p><strong>Data to merge:</strong></p>
              <ul className="list-disc list-inside text-muted-foreground">
                <li>{mergeData.preview.checkins} check-in(s)</li>
                <li>{mergeData.preview.events} event(s)</li>
                <li>{mergeData.preview.accounts.length} linked account(s)</li>
              </ul>
            </div>
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <p className="text-sm text-destructive font-medium">
              This action is irreversible.
            </p>
            <div className="flex gap-3">
              <Button
                variant="destructive"
                onClick={confirmMerge}
                disabled={merging}
              >
                {merging ? "Merging..." : "Confirm Merge"}
              </Button>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {phase === "success" && (
          <p className="text-sm">
            Account <strong>@{normalize(handle)}</strong> linked successfully.
          </p>
        )}

        {phase === "error" && (
          <div className="space-y-4">
            <Alert variant="destructive">
              <AlertDescription>{error || "Failed"}</AlertDescription>
            </Alert>
            <div className="flex gap-3">
              <Button onClick={() => setPhase("challenge")}>Retry</Button>
              <Button variant="outline" onClick={reset}>Start over</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
