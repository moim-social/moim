import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Separator } from "~/components/ui/separator";
import { ArrowLeft, ArrowRight, Check, Ticket } from "lucide-react";

export const Route = createFileRoute("/events/$eventId/register")({
  component: RegisterPage,
});

type TierInfo = {
  id: string;
  name: string;
  description: string | null;
  price: string | null;
  opensAt: string | null;
  closesAt: string | null;
  capacity: number | null;
  acceptedCount: number;
  waitlistedCount: number;
  sortOrder: number;
};

type Question = {
  id: string;
  question: string;
  sortOrder: number;
  required: boolean;
};

type RsvpData = {
  questions: Question[];
  tiers: TierInfo[];
  rsvpCounts: { accepted: number; declined: number; waitlisted: number };
  tierCounts: Array<{ tierId: string; status: string; count: number }>;
  userRsvp: {
    status: string;
    tierId: string | null;
    answers: Array<{ questionId: string; answer: string }>;
    waitlistPosition: number | null;
  } | null;
  isAuthenticated: boolean;
};

type EventMeta = {
  event: {
    id: string;
    title: string;
    startsAt: string;
    endsAt: string | null;
    timezone: string | null;
    location: string | null;
    groupHandle: string | null;
  };
};

function RegisterPage() {
  const { eventId } = Route.useParams();
  const navigate = useNavigate();

  const [rsvpData, setRsvpData] = useState<RsvpData | null>(null);
  const [eventMeta, setEventMeta] = useState<EventMeta | null>(null);
  const [loading, setLoading] = useState(true);

  // Multi-step state
  const [step, setStep] = useState(0); // 0: select tier, 1: questions, 2: confirm
  const [selectedTierId, setSelectedTierId] = useState<string>("");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [resultStatus, setResultStatus] = useState<string>("");

  // Fetch data
  useEffect(() => {
    Promise.all([
      fetch(`/api/events/${eventId}/rsvp`).then((r) => r.json()),
      fetch(`/api/events/${eventId}`).then((r) => r.json()),
    ])
      .then(([rsvp, meta]) => {
        setRsvpData(rsvp);
        setEventMeta(meta);

        // Pre-fill from existing RSVP
        if (rsvp.userRsvp?.tierId) {
          setSelectedTierId(rsvp.userRsvp.tierId);
        } else if (rsvp.tiers?.length === 1) {
          setSelectedTierId(rsvp.tiers[0].id);
        }
        if (rsvp.userRsvp?.answers) {
          const prefilled: Record<string, string> = {};
          for (const a of rsvp.userRsvp.answers) {
            prefilled[a.questionId] = a.answer;
          }
          setAnswers(prefilled);
        }

        // If not authenticated, redirect to sign in
        if (!rsvp.isAuthenticated) {
          navigate({ to: "/auth/signin", search: { reason: "rsvp" } });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [eventId, navigate]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!rsvpData || !eventMeta) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-destructive">Failed to load registration data.</p>
      </div>
    );
  }

  const { tiers, questions } = rsvpData;
  const event = eventMeta.event;

  // Already registered — show status instead of form
  const existingRsvp = rsvpData.userRsvp;
  if (existingRsvp && (existingRsvp.status === "accepted" || existingRsvp.status === "waitlisted")) {
    const existingTier = tiers.find((t) => t.id === existingRsvp.tierId);
    return (
      <div className="mx-auto max-w-lg px-4 py-12">
        <Card>
          <CardContent className="pt-6 text-center space-y-4">
            <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-primary/10">
              {existingRsvp.status === "waitlisted" ? (
                <Ticket className="size-8 text-primary" />
              ) : (
                <Check className="size-8 text-primary" />
              )}
            </div>
            <h2 className="text-xl font-semibold">
              {existingRsvp.status === "waitlisted" ? "You're on the waitlist" : "You're already registered"}
            </h2>
            <p className="text-sm text-muted-foreground">
              {existingRsvp.status === "waitlisted"
                ? `You're #${existingRsvp.waitlistPosition ?? "?"} on the waitlist. You'll be automatically promoted if a spot opens up.`
                : `You're confirmed for ${event.title}.`}
            </p>
            {existingTier && (
              <div className="rounded-lg border p-4 text-left space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{existingTier.name}</span>
                  <span className="text-sm text-muted-foreground">{existingTier.price || "Free"}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {new Date(event.startsAt).toLocaleDateString(undefined, {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                    timeZone: event.timezone ?? undefined,
                  })}
                </p>
                {event.location && (
                  <p className="text-xs text-muted-foreground">{event.location}</p>
                )}
                {existingRsvp.answers && existingRsvp.answers.length > 0 && questions.length > 0 && (
                  <>
                    <Separator />
                    <div className="space-y-2">
                      {questions
                        .filter((q) => existingRsvp.answers.some((a) => a.questionId === q.id && a.answer.trim()))
                        .map((q, i) => {
                          const answer = existingRsvp.answers.find((a) => a.questionId === q.id);
                          return (
                            <div key={q.id}>
                              <p className="text-xs text-muted-foreground">{i + 1}. {q.question}</p>
                              <p className="text-sm">{answer?.answer}</p>
                            </div>
                          );
                        })}
                    </div>
                  </>
                )}
              </div>
            )}
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={handleDecline} disabled={submitting}>
                {submitting ? "Cancelling..." : "Cancel Registration"}
              </Button>
              <Button asChild className="flex-1">
                <Link to="/events/$eventId" params={{ eventId }}>Back to Event</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const hasMultipleTiers = tiers.length > 1;
  const hasQuestions = questions.length > 0;

  // Determine steps
  const steps: Array<"tier" | "questions" | "confirm"> = [];
  if (hasMultipleTiers) steps.push("tier");
  if (hasQuestions) steps.push("questions");
  steps.push("confirm");

  const currentStepType = steps[step];
  const totalSteps = steps.length;

  // If single tier, auto-select it
  if (!hasMultipleTiers && tiers.length === 1 && !selectedTierId) {
    setSelectedTierId(tiers[0].id);
  }

  const selectedTier = tiers.find((t) => t.id === selectedTierId);
  const isFull = selectedTier
    ? selectedTier.capacity != null && selectedTier.capacity > 0 && selectedTier.acceptedCount >= selectedTier.capacity
    : false;

  // Validate current step
  function canProceed(): boolean {
    if (currentStepType === "tier") {
      return !!selectedTierId;
    }
    if (currentStepType === "questions") {
      const requiredIds = questions.filter((q) => q.required).map((q) => q.id);
      return requiredIds.every((id) => answers[id]?.trim());
    }
    return true;
  }

  async function handleSubmit() {
    setSubmitting(true);
    setSubmitError("");
    try {
      const res = await fetch(`/api/events/${eventId}/rsvp`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId,
          status: "accepted",
          tierId: selectedTierId || undefined,
          answers: Object.entries(answers).map(([questionId, answer]) => ({
            questionId,
            answer,
          })),
        }),
      });
      const result = await res.json();
      if (!res.ok) {
        setSubmitError(result.error ?? "Failed to submit");
        setSubmitting(false);
        return;
      }
      setResultStatus(result.status);
      setSubmitted(true);
    } catch {
      setSubmitError("Network error");
    }
    setSubmitting(false);
  }

  async function handleDecline() {
    setSubmitting(true);
    setSubmitError("");
    try {
      const res = await fetch(`/api/events/${eventId}/rsvp`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId, status: "declined" }),
      });
      if (res.ok) {
        navigate({ to: "/events/$eventId", params: { eventId } });
      }
    } catch {
      setSubmitError("Network error");
    }
    setSubmitting(false);
  }

  // Success screen
  if (submitted) {
    return (
      <div className="mx-auto max-w-lg px-4 py-12">
        <Card>
          <CardContent className="pt-6 text-center space-y-4">
            <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-primary/10">
              {resultStatus === "waitlisted" ? (
                <Ticket className="size-8 text-primary" />
              ) : (
                <Check className="size-8 text-primary" />
              )}
            </div>
            <h2 className="text-xl font-semibold">
              {resultStatus === "waitlisted" ? "You're on the waitlist" : "You're registered!"}
            </h2>
            <p className="text-sm text-muted-foreground">
              {resultStatus === "waitlisted"
                ? "This ticket is currently full. You'll be automatically promoted if a spot opens up."
                : `You're confirmed for ${event.title}.`}
            </p>
            {selectedTier && (
              <div className="rounded-lg border p-4 text-left space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{selectedTier.name}</span>
                  <span className="text-sm text-muted-foreground">{selectedTier.price || "Free"}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {new Date(event.startsAt).toLocaleDateString(undefined, {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                    timeZone: event.timezone ?? undefined,
                  })}
                </p>
                {event.location && (
                  <p className="text-xs text-muted-foreground">{event.location}</p>
                )}
              </div>
            )}
            <Button asChild className="w-full">
              <Link to="/events/$eventId" params={{ eventId }}>Back to Event</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const eventTz = event.timezone ?? undefined;
  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: eventTz,
    });

  return (
    <div className="mx-auto max-w-lg px-4 py-8 space-y-6">
      {/* Header */}
      <div>
        <Link
          to="/events/$eventId"
          params={{ eventId }}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="size-4" />
          Back to event
        </Link>
        <h1 className="text-2xl font-bold">{event.title}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {new Date(event.startsAt).toLocaleDateString(undefined, {
            weekday: "short",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            timeZone: eventTz,
          })}
          {event.location && ` · ${event.location}`}
        </p>
      </div>

      {/* Step indicator */}
      {totalSteps > 1 && (
        <div className="flex items-center">
          {steps.map((s, i) => (
            <div key={s} className="flex items-center">
              <div className="flex items-center gap-2">
                <div
                  className={`flex size-7 items-center justify-center rounded-full text-xs font-medium shrink-0 ${
                    i <= step
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {i < step ? <Check className="size-3.5" /> : i + 1}
                </div>
                <span className={`text-sm whitespace-nowrap ${i === step ? "font-medium" : "text-muted-foreground"}`}>
                  {s === "tier" ? "Select Ticket" : s === "questions" ? "Questions" : "Confirm"}
                </span>
              </div>
              {i < steps.length - 1 && (
                <Separator className="mx-3 flex-1 min-w-6" />
              )}
            </div>
          ))}
        </div>
      )}

      {submitError && (
        <p className="text-sm text-destructive rounded-md border border-destructive/20 bg-destructive/5 p-3">
          {submitError}
        </p>
      )}

      {/* Step: Select Tier */}
      {currentStepType === "tier" && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Select a ticket</h2>
          {tiers.map((t) => {
            const now = new Date();
            const effectiveClose = t.closesAt ?? event.startsAt;
            const isOpen =
              (!t.opensAt || new Date(t.opensAt) <= now) &&
              new Date(effectiveClose) > now;
            const tierFull =
              t.capacity != null && t.capacity > 0 && t.acceptedCount >= t.capacity;
            const isSelected = selectedTierId === t.id;

            return (
              <button
                key={t.id}
                type="button"
                disabled={!isOpen}
                onClick={() => setSelectedTierId(t.id)}
                className={`w-full text-left rounded-lg border-2 p-4 transition-all ${
                  isSelected
                    ? "border-primary bg-accent/50 shadow-sm"
                    : "border-border hover:border-primary/40"
                } ${!isOpen ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{t.name}</span>
                      {!isOpen && (
                        <Badge variant="secondary" className="text-xs">Closed</Badge>
                      )}
                      {tierFull && isOpen && (
                        <Badge variant="outline" className="text-xs">Full</Badge>
                      )}
                    </div>
                    {t.description && (
                      <p className="text-sm text-muted-foreground mt-1">{t.description}</p>
                    )}
                    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                      {t.capacity != null && t.capacity > 0 && (
                        <span>{t.acceptedCount} / {t.capacity} spots</span>
                      )}
                      {t.opensAt && !isOpen && new Date(t.opensAt) > now && (
                        <span>Opens {fmt(t.opensAt)}</span>
                      )}
                      {t.closesAt && isOpen && (
                        <span>Closes {fmt(t.closesAt)}</span>
                      )}
                    </div>
                    {tierFull && isOpen && (
                      <p className="text-xs text-muted-foreground mt-1">
                        You will be added to the waitlist
                      </p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-lg font-bold">{t.price || "Free"}</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Step: Questions */}
      {currentStepType === "questions" && (
        <div className="space-y-6">
          <h2 className="text-lg font-semibold">Registration questions</h2>
          {questions.map((q, i) => (
            <div key={q.id} className="space-y-3">
              <Label>
                {i + 1}. {q.question}
                {q.required && <span className="text-destructive ml-1">*</span>}
              </Label>
              <Input
                value={answers[q.id] ?? ""}
                onChange={(e) =>
                  setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))
                }
                placeholder="Your answer..."
              />
            </div>
          ))}
        </div>
      )}

      {/* Step: Confirm */}
      {currentStepType === "confirm" && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Confirm registration</h2>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Your ticket</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {selectedTier && (
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-medium">{selectedTier.name}</span>
                    {selectedTier.description && (
                      <p className="text-xs text-muted-foreground mt-0.5">{selectedTier.description}</p>
                    )}
                  </div>
                  <span className="font-semibold">{selectedTier.price || "Free"}</span>
                </div>
              )}
              <Separator />
              <div className="text-sm space-y-1">
                <p>{event.title}</p>
                <p className="text-muted-foreground">
                  {new Date(event.startsAt).toLocaleDateString(undefined, {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                    timeZone: eventTz,
                  })}
                </p>
                {event.location && (
                  <p className="text-muted-foreground">{event.location}</p>
                )}
              </div>
              {Object.keys(answers).length > 0 && (
                <>
                  <Separator />
                  <div className="text-sm space-y-2">
                    {questions
                      .filter((q) => answers[q.id]?.trim())
                      .map((q) => (
                        <div key={q.id}>
                          <p className="text-xs text-muted-foreground">{q.question}</p>
                          <p>{answers[q.id]}</p>
                        </div>
                      ))}
                  </div>
                </>
              )}
              {isFull && (
                <>
                  <Separator />
                  <p className="text-sm text-muted-foreground">
                    This ticket is full — you will be placed on the waitlist.
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between pt-2">
        <div>
          {step > 0 && (
            <Button variant="ghost" onClick={() => setStep(step - 1)}>
              <ArrowLeft className="size-4 mr-1" />
              Back
            </Button>
          )}
        </div>
        <div className="flex items-center gap-2">
          {rsvpData.userRsvp && rsvpData.userRsvp.status !== "declined" && currentStepType === "confirm" && (
            <Button
              variant="outline"
              onClick={handleDecline}
              disabled={submitting}
            >
              Cancel registration
            </Button>
          )}
          {currentStepType === "confirm" ? (
            <Button onClick={handleSubmit} disabled={submitting || !canProceed()}>
              {submitting
                ? "Submitting..."
                : isFull
                  ? "Join Waitlist"
                  : rsvpData.userRsvp && rsvpData.userRsvp.status !== "declined"
                    ? "Update Registration"
                    : "Confirm Registration"}
            </Button>
          ) : (
            <Button onClick={() => setStep(step + 1)} disabled={!canProceed()}>
              Next
              <ArrowRight className="size-4 ml-1" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
