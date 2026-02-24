import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Alert, AlertDescription } from "~/components/ui/alert";

export const Route = createFileRoute("/auth/signin")({
  component: SignInPage,
});

type Phase = "handle" | "challenge" | "waiting" | "success" | "error";

function SignInPage() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>("handle");
  const [handle, setHandle] = useState("");
  const [challengeId, setChallengeId] = useState("");
  const [expectedEmojis, setExpectedEmojis] = useState<string[]>([]);
  const [allEmojis, setAllEmojis] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function normalizeHandle(h: string): string {
    return h.startsWith("@") ? h.slice(1) : h;
  }

  async function requestOtp() {
    setError("");
    const normalized = normalizeHandle(handle);
    try {
      const res = await fetch("/auth/request-otp", {
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

  function startPolling() {
    setPhase("waiting");
    setError("");
  }

  // Auto-poll verify endpoint when in waiting phase
  useEffect(() => {
    if (phase !== "waiting") return;

    const normalized = normalizeHandle(handle);

    const poll = async () => {
      try {
        const res = await fetch("/auth/verify-otp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ handle: normalized, challengeId }),
        });
        const data = await res.json();
        if (data.ok) {
          setPhase("success");
          setTimeout(() => navigate({ to: "/" }), 2000);
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

    // Poll immediately, then every 3 seconds
    poll();
    intervalRef.current = setInterval(poll, 3000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [phase, handle, challengeId, navigate]);

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
  }

  return (
    <main className="mx-auto max-w-md">
      <h2 className="text-2xl font-semibold tracking-tight mb-6">Sign in</h2>

      {error && phase === "handle" && (
        <Alert variant="destructive" className="mb-4">
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
            <Label htmlFor="handle">Fediverse handle</Label>
            <Input
              id="handle"
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
          <p>
            A poll has been sent to your Fediverse account as a DM.
            Select the highlighted emojis in the poll, then click Verify.
          </p>
          <div className="grid grid-cols-4 gap-2">
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
          <p className="text-sm text-muted-foreground">
            If your Fediverse client doesn't show the poll, try a different client.
          </p>
          {expiresAt && (
            <p className="text-sm text-muted-foreground">
              Expires: {new Date(expiresAt).toLocaleTimeString()}
            </p>
          )}
          <div className="flex gap-3">
            <Button onClick={startPolling}>Verify</Button>
            <Button variant="outline" onClick={reset}>Cancel</Button>
          </div>
        </div>
      )}

      {phase === "waiting" && (
        <div className="space-y-4">
          <p className="text-muted-foreground">
            Waiting for your poll response... This may take up to 30 seconds.
          </p>
          <Button variant="outline" onClick={reset}>Cancel</Button>
        </div>
      )}

      {phase === "success" && (
        <p>Signed in as <strong>@{normalizeHandle(handle)}</strong>. Redirecting...</p>
      )}

      {phase === "error" && (
        <div className="space-y-4">
          <Alert variant="destructive">
            <AlertDescription>{error || "Verification failed"}</AlertDescription>
          </Alert>
          <div className="flex gap-3">
            <Button onClick={() => setPhase("challenge")}>Retry</Button>
            <Button variant="outline" onClick={reset}>Start over</Button>
          </div>
        </div>
      )}
    </main>
  );
}
