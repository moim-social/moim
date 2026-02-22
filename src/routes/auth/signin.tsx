import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";

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
    <main style={{ maxWidth: 480 }}>
      <h2>Sign in</h2>

      {error && phase === "handle" && (
        <div
          style={{
            background: "#fef2f2",
            border: "1px solid #fca5a5",
            borderRadius: 8,
            padding: "12px 16px",
            marginBottom: 16,
            color: "#991b1b",
          }}
        >
          {error}
        </div>
      )}

      {phase === "handle" && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            requestOtp();
          }}
        >
          <label style={{ display: "block", marginBottom: 8 }}>
            Fediverse handle
          </label>
          <input
            type="text"
            placeholder="@user@mastodon.social"
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
            required
            style={{
              width: "100%",
              padding: "8px 12px",
              fontSize: 16,
              boxSizing: "border-box",
            }}
          />
          <button
            type="submit"
            style={{ marginTop: 12, padding: "8px 24px", fontSize: 16 }}
          >
            Request OTP
          </button>
        </form>
      )}

      {phase === "otp" && (
        <div>
          <p>Post this code on your Fediverse account, then click Verify.</p>
          <div
            style={{
              fontFamily: "monospace",
              fontSize: 36,
              letterSpacing: 8,
              padding: "16px 24px",
              background: "#f5f5f5",
              borderRadius: 8,
              display: "inline-block",
              marginBottom: 16,
              userSelect: "all",
            }}
          >
            {otp}
          </div>
          {expiresAt && (
            <p style={{ fontSize: 14, color: "#666" }}>
              Expires: {new Date(expiresAt).toLocaleTimeString()}
            </p>
          )}
          <div style={{ marginTop: 16, display: "flex", gap: 12 }}>
            <button
              onClick={verifyOtp}
              style={{ padding: "8px 24px", fontSize: 16 }}
            >
              Verify
            </button>
            <button
              onClick={reset}
              style={{ padding: "8px 24px", fontSize: 16 }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {phase === "verifying" && (
        <p>Checking your outbox for the OTP...</p>
      )}

      {phase === "success" && (
        <p>Signed in as <strong>@{normalizeHandle(handle)}</strong>. Redirecting...</p>
      )}

      {phase === "error" && (
        <div>
          <div
            style={{
              background: "#fef2f2",
              border: "1px solid #fca5a5",
              borderRadius: 8,
              padding: "12px 16px",
              marginBottom: 16,
              color: "#991b1b",
            }}
          >
            {error || "Verification failed"}
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <button
              onClick={() => setPhase("otp")}
              style={{ padding: "8px 24px", fontSize: 16 }}
            >
              Retry
            </button>
            <button
              onClick={reset}
              style={{ padding: "8px 24px", fontSize: 16 }}
            >
              Start over
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
