import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Alert, AlertDescription } from "~/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { useAuth } from "~/routes/__root";
import { usePostHog } from "posthog-js/react";

export const Route = createFileRoute("/auth/signin")({
  component: SignInPage,
  validateSearch: (
    search: Record<string, unknown>,
  ): { from?: string; reason?: string; event?: string } => ({
    from: typeof search.from === "string" ? search.from : undefined,
    reason: typeof search.reason === "string" ? search.reason : undefined,
    event: typeof search.event === "string" ? search.event : undefined,
  }),
});

// ─── Auth Provider Registry ─────────────────────────────────────────────────
//
// To add a new auth provider:
// 1. Define a DialogForm component (see MiAuthDialogForm for example)
// 2. Add an entry to AUTH_PROVIDERS below
//
// The first provider marked `primary: true` renders inline on the page.
// All others render as "Or sign in with" buttons that open dialogs.

type AuthProviderDef = {
  id: string;
  name: string;
  icon: string;
  dialogTitle: string;
  dialogDescription: string;
  DialogForm: React.ComponentType<{ onClose: () => void }>;
};

const AUTH_PROVIDERS: AuthProviderDef[] = [
  {
    id: "misskey",
    name: "Misskey",
    icon: "🔑",
    dialogTitle: "Sign in with Misskey",
    dialogDescription:
      "You'll be redirected to authorize on your Misskey instance.",
    DialogForm: MiAuthDialogForm,
  },
  // To add a new provider:
  // {
  //   id: "email",
  //   name: "Email",
  //   icon: "✉️",
  //   dialogTitle: "Sign in with Email",
  //   dialogDescription: "We'll send a magic link to your inbox.",
  //   DialogForm: EmailDialogForm,
  // },
];

// ─── OTP Step Indicator ─────────────────────────────────────────────────────

type Phase = "handle" | "challenge" | "waiting" | "success" | "error";

const STEPS = [
  { label: "Handle", phases: ["handle"] },
  { label: "Vote", phases: ["challenge", "waiting"] },
  { label: "Done", phases: ["success"] },
] as const;

function StepIndicator({ phase }: { phase: Phase }) {
  const currentIdx = STEPS.findIndex((s) =>
    (s.phases as readonly string[]).includes(phase),
  );

  return (
    <div className="flex items-center justify-center gap-1">
      {STEPS.map((step, i) => {
        const isCompleted = i < currentIdx;
        const isActive = i === currentIdx;
        return (
          <div key={step.label} className="flex items-center gap-1">
            {i > 0 && (
              <div
                className={`h-0.5 w-6 ${isCompleted || isActive ? "bg-primary" : "bg-border"}`}
              />
            )}
            <div className="flex items-center gap-1.5">
              <div
                className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium ${
                  isCompleted || isActive
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {isCompleted ? "✓" : i + 1}
              </div>
              <span
                className={`text-xs ${isActive ? "font-medium" : "text-muted-foreground"}`}
              >
                {step.label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Provider Dialog Forms ──────────────────────────────────────────────────

function MiAuthDialogForm({ onClose: _onClose }: { onClose: () => void }) {
  const [instance, setInstance] = useState("");
  const [error, setError] = useState("");

  async function submit() {
    setError("");
    const trimmed = instance.trim();
    if (!trimmed) {
      setError("Please enter a Misskey instance");
      return;
    }

    try {
      const res = await fetch("/api/auth/misskey/miauth-start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instance: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to start Misskey login");
        return;
      }
      window.location.href = data.redirectUrl;
    } catch {
      setError("Network error");
    }
  }

  return (
    <>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="space-y-4"
      >
        <div className="space-y-2">
          <Label htmlFor="miauth-instance">Instance URL</Label>
          <Input
            id="miauth-instance"
            type="text"
            placeholder="misskey.io"
            value={instance}
            onChange={(e) => setInstance(e.target.value)}
            required
            autoFocus
          />
        </div>
        <Button type="submit" className="w-full">
          Continue to Misskey
        </Button>
      </form>
    </>
  );
}

// ─── Sign In Page ───────────────────────────────────────────────────────────

function SignInPage() {
  const navigate = useNavigate();
  const { from, reason } = Route.useSearch();
  const { user, setUser, loaded } = useAuth();
  const posthog = usePostHog();

  // OTP state
  const [phase, setPhase] = useState<Phase>("handle");
  const [handle, setHandle] = useState("");
  const [challengeId, setChallengeId] = useState("");
  const [expectedEmojis, setExpectedEmojis] = useState<string[]>([]);
  const [allEmojis, setAllEmojis] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Which provider dialog is open (by id), or null
  const [openProviderId, setOpenProviderId] = useState<string | null>(null);

  useEffect(() => {
    if (loaded && user) {
      navigate({ to: "/" });
    }
  }, [loaded, user, navigate]);

  if (loaded && user) return null;

  function normalizeHandle(h: string): string {
    return h.startsWith("@") ? h.slice(1) : h;
  }

  async function requestOtp() {
    setError("");
    const normalized = normalizeHandle(handle);
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

  function startPolling() {
    setPhase("waiting");
    setError("");
  }

  useEffect(() => {
    if (phase !== "waiting") return;

    const normalized = normalizeHandle(handle);

    const poll = async () => {
      try {
        const res = await fetch("/api/auth/otp-verifications", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ handle: normalized, challengeId }),
        });
        const data = await res.json();
        if (data.ok) {
          setUser({
            handle: data.user?.handle ?? normalized,
            displayName: data.user?.handle ?? normalized,
          });
          setPhase("success");
          posthog?.capture("sign_in", { handle: normalized });
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

  const showSteps = ["challenge", "waiting", "success"].includes(phase);

  return (
    <main className="mx-auto max-w-md py-8">
      <Card>
        <CardHeader className="text-center">
          <img src="/logo.png" alt="moim" className="mx-auto h-10 w-auto" />
          <CardTitle className="text-2xl">Sign in</CardTitle>
          <CardDescription>
            Sign in with your Fediverse account
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {from === "onboarding" && phase === "handle" && (
            <Alert>
              <AlertDescription>
                Welcome! Enter the handle you just created to sign in.
              </AlertDescription>
            </Alert>
          )}

          {reason === "rsvp" && phase === "handle" && (
            <Alert>
              <AlertDescription>
                Sign in to RSVP for this event.
              </AlertDescription>
            </Alert>
          )}

          {showSteps && <StepIndicator phase={phase} />}

          {/* Primary: Fediverse OTP flow */}
          {phase === "handle" && (
            <>
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  requestOtp();
                }}
                className="space-y-4"
              >
                <div className="space-y-2">
                  <Label htmlFor="handle">Your handle</Label>
                  <Input
                    id="handle"
                    type="text"
                    placeholder="@user@mastodon.social"
                    value={handle}
                    onChange={(e) => setHandle(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full">
                  Continue
                </Button>
                <p className="text-xs text-muted-foreground">
                  We'll send an emoji poll to your DMs to verify you own this
                  account.
                </p>
              </form>
            </>
          )}

          {phase === "challenge" && (
            <div className="space-y-4">
              <p className="text-sm font-medium">
                Vote on the emoji poll we sent to your DMs!
              </p>
              <p className="text-sm text-muted-foreground">
                Select the highlighted emojis in the poll on your Fediverse
                client.
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
                <p className="text-xs text-muted-foreground">
                  Expires: {new Date(expiresAt).toLocaleTimeString()}
                </p>
              )}
              <div className="flex gap-3">
                <Button onClick={startPolling} className="flex-1">
                  I've voted
                </Button>
                <Button variant="outline" onClick={reset}>
                  Cancel
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Can't see the DM? Try a different Fediverse client, or check
                your message requests.
              </p>
            </div>
          )}

          {phase === "waiting" && (
            <div className="space-y-4 text-center">
              <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
              <p className="text-sm text-muted-foreground">
                Verifying your poll response...
              </p>
              <Button variant="outline" size="sm" onClick={reset}>
                Cancel
              </Button>
            </div>
          )}

          {phase === "success" && (
            <div className="space-y-2 text-center">
              <p className="text-lg font-medium">Welcome!</p>
              <p className="text-sm text-muted-foreground">
                Signed in as{" "}
                <strong>@{normalizeHandle(handle)}</strong>.
                Redirecting...
              </p>
            </div>
          )}

          {phase === "error" && (
            <div className="space-y-4">
              <Alert variant="destructive">
                <AlertDescription>
                  {error || "Verification failed"}
                </AlertDescription>
              </Alert>
              <div className="flex gap-3">
                <Button onClick={() => setPhase("challenge")}>Retry</Button>
                <Button variant="outline" onClick={reset}>
                  Start over
                </Button>
              </div>
            </div>
          )}

          {/* Alternative auth providers */}
          {phase === "handle" && AUTH_PROVIDERS.length > 0 && (
            <div className="space-y-3 pt-2">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">
                    Or sign in with
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap justify-center gap-2">
                {AUTH_PROVIDERS.map((provider) => (
                  <Button
                    key={provider.id}
                    variant="outline"
                    size="sm"
                    onClick={() => setOpenProviderId(provider.id)}
                  >
                    <span>{provider.icon}</span>
                    {provider.name}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </CardContent>

        <CardFooter className="justify-center">
          <p className="text-sm text-muted-foreground">
            New to the Fediverse?{" "}
            <Link
              to="/auth/onboarding"
              className="text-primary hover:underline"
            >
              Get started
            </Link>
          </p>
        </CardFooter>
      </Card>

      {/* Provider dialogs — one per provider, rendered from registry */}
      {AUTH_PROVIDERS.map((provider) => (
        <Dialog
          key={provider.id}
          open={openProviderId === provider.id}
          onOpenChange={(open) => setOpenProviderId(open ? provider.id : null)}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{provider.dialogTitle}</DialogTitle>
              <DialogDescription>
                {provider.dialogDescription}
              </DialogDescription>
            </DialogHeader>
            <provider.DialogForm
              onClose={() => setOpenProviderId(null)}
            />
          </DialogContent>
        </Dialog>
      ))}
    </main>
  );
}
