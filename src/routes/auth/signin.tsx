import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Alert, AlertDescription } from "~/components/ui/alert";

export const Route = createFileRoute("/auth/signin")({
  component: SignInPage,
});

type Phase = "handle" | "otp" | "verifying" | "success" | "error";

function SignInPage() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>("handle");
  const [handle, setHandle] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [expiresAt, setExpiresAt] = useState("");

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
      setOtp(data.otp);
      setExpiresAt(data.expiresAt);
      setPhase("otp");
    } catch {
      setError("Network error");
    }
  }

  async function verifyOtp() {
    setPhase("verifying");
    setError("");
    const normalized = normalizeHandle(handle);
    try {
      const res = await fetch("/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handle: normalized }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Verification failed");
        setPhase("error");
        return;
      }
      setPhase("success");
      setTimeout(() => navigate({ to: "/" }), 2000);
    } catch {
      setError("Network error");
      setPhase("error");
    }
  }

  function reset() {
    setPhase("handle");
    setHandle("");
    setOtp("");
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

      {phase === "otp" && (
        <div className="space-y-4">
          <p>Post this code on your Fediverse account, then click Verify.</p>
          <div className="font-mono text-4xl tracking-[8px] px-6 py-4 bg-muted rounded-lg inline-block select-all">
            {otp}
          </div>
          {expiresAt && (
            <p className="text-sm text-muted-foreground">
              Expires: {new Date(expiresAt).toLocaleTimeString()}
            </p>
          )}
          <div className="flex gap-3">
            <Button onClick={verifyOtp}>Verify</Button>
            <Button variant="outline" onClick={reset}>Cancel</Button>
          </div>
        </div>
      )}

      {phase === "verifying" && (
        <p className="text-muted-foreground">Checking your outbox for the OTP...</p>
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
            <Button onClick={() => setPhase("otp")}>Retry</Button>
            <Button variant="outline" onClick={reset}>Start over</Button>
          </div>
        </div>
      )}
    </main>
  );
}
