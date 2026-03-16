import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { usePostHog } from "posthog-js/react";
import { useEventCategories } from "~/hooks/useEventCategories";
import { Button } from "~/components/ui/button";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Card, CardContent } from "~/components/ui/card";
import { type SelectedPlace } from "~/components/PlacePicker";
import { datetimeLocalToUTC } from "~/lib/timezone";

import { Stepper } from "~/components/event-form/Stepper";
import { HostCard } from "~/components/event-form/HostCard";
import { BasicInfoCard } from "~/components/event-form/BasicInfoCard";
import { WhenCard } from "~/components/event-form/WhenCard";
import { DescriptionCard } from "~/components/event-form/DescriptionCard";
import { WhereCard } from "~/components/event-form/WhereCard";
import { ExternalUrlCard } from "~/components/event-form/ExternalUrlCard";
import { MoreOptionsCard } from "~/components/event-form/MoreOptionsCard";
import { QuestionsStep } from "~/components/event-form/QuestionsStep";

export const Route = createFileRoute("/events/create")({
  component: CreateEventPage,
});

type Phase = "basic" | "questions" | "submitting" | "error";

type Organizer = {
  handle: string;
  name: string;
  source: "local" | "fediverse";
};

type QuestionDraft = {
  question: string;
  required: boolean;
};

function CreateEventPage() {
  const navigate = useNavigate();
  const posthog = usePostHog();
  const { categories } = useEventCategories();
  const [phase, setPhase] = useState<Phase>("basic");
  const [error, setError] = useState("");

  // Auth guard
  const [authed, setAuthed] = useState<boolean | null>(null);
  useEffect(() => {
    fetch("/api/session")
      .then((r) => r.json())
      .then((data) => {
        if (!data.user) {
          navigate({ to: "/auth/signin" });
        } else {
          setAuthed(true);
        }
      })
      .catch(() => navigate({ to: "/auth/signin" }));
  }, [navigate]);

  // Groups the user can create events for
  const [groups, setGroups] = useState<
    { id: string; handle: string; name: string | null; timezone: string | null }[]
  >([]);
  const [groupsLoaded, setGroupsLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/me/groups")
      .then((r) => r.json())
      .then((data) => {
        setGroups(data.groups ?? []);
        setGroupsLoaded(true);
      })
      .catch(() => setGroupsLoaded(true));
  }, []);

  // Event fields
  const [groupActorId, setGroupActorId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [selectedPlace, setSelectedPlace] = useState<SelectedPlace | null>(null);
  const [venueDetail, setVenueDetail] = useState("");
  const [externalUrl, setExternalUrl] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [timezone, setTimezone] = useState<string | null>(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
  );

  // Organizers
  const [organizers, setOrganizers] = useState<Organizer[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<
    { handle: string; displayName: string }[]
  >([]);
  const [fedHandle, setFedHandle] = useState("");
  const [resolving, setResolving] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Header image
  const [headerImageBlob, setHeaderImageBlob] = useState<Blob | null>(null);
  const [headerImagePreview, setHeaderImagePreview] = useState<string | null>(null);
  const [cropSrc, setCropSrc] = useState<string | null>(null);

  // Survey questions
  const [questions, setQuestions] = useState<QuestionDraft[]>([]);

  // Debounced user search
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }
    searchTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/users?query=${encodeURIComponent(searchQuery)}`,
        );
        const data = await res.json();
        setSearchResults(data.users ?? []);
      } catch {
        setSearchResults([]);
      }
    }, 300);
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [searchQuery]);

  function addLocalOrganizer(user: {
    handle: string;
    displayName: string;
  }) {
    if (organizers.some((o) => o.handle === user.handle)) return;
    setOrganizers((prev) => [
      ...prev,
      { handle: user.handle, name: user.displayName, source: "local" },
    ]);
    setSearchQuery("");
    setSearchResults([]);
  }

  async function resolveFediOrganizer() {
    if (!fedHandle.trim()) return;
    setResolving(true);
    setError("");
    try {
      const res = await fetch("/api/actors/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handle: fedHandle }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to resolve handle");
        setResolving(false);
        return;
      }
      const normalized = fedHandle.startsWith("@")
        ? fedHandle.slice(1)
        : fedHandle;
      if (!organizers.some((o) => o.handle === normalized)) {
        setOrganizers((prev) => [
          ...prev,
          { handle: normalized, name: data.actor.name, source: "fediverse" },
        ]);
      }
      setFedHandle("");
    } catch {
      setError("Network error");
    }
    setResolving(false);
  }

  function removeOrganizer(handle: string) {
    setOrganizers((prev) => prev.filter((o) => o.handle !== handle));
  }

  async function submitEvent() {
    setPhase("submitting");
    setError("");
    try {
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description: description || undefined,
          placeId: selectedPlace?.id || undefined,
          location: selectedPlace?.name || undefined,
          venueDetail: venueDetail.trim() || undefined,
          externalUrl: externalUrl || undefined,
          categoryId: categoryId || undefined,
          groupActorId: groupActorId || undefined,
          startsAt: datetimeLocalToUTC(startsAt, timezone),
          endsAt: endsAt ? datetimeLocalToUTC(endsAt, timezone) : undefined,
          timezone: timezone || undefined,
          organizerHandles: organizers.map((o) => o.handle),
          questions: questions
            .filter((q) => q.question.trim())
            .map((q, idx) => ({
              question: q.question,
              sortOrder: idx,
              required: q.required,
            })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to create event");
        setPhase("error");
        return;
      }
      posthog?.capture("event_created", { eventId: data.event.id });

      // Upload header image if cropped (non-blocking)
      if (headerImageBlob) {
        try {
          const formData = new FormData();
          formData.append("file", headerImageBlob, "header.webp");
          await fetch(`/api/events/${data.event.id}/header-image`, {
            method: "POST",
            body: formData,
          });
        } catch {
          // Non-blocking: event is created, image upload failure is not critical
        }
      }

      // Redirect to dashboard
      navigate({
        to: "/events/$eventId/dashboard",
        params: { eventId: data.event.id },
      });
    } catch {
      setError("Network error");
      setPhase("error");
    }
  }

  if (authed === null) {
    return <p className="text-muted-foreground">Loading...</p>;
  }

  const currentStep =
    phase === "basic" ? 0
    : phase === "questions" ? 1
    : phase === "submitting" ? 1
    : 1;

  return (
    <main className="mx-auto max-w-2xl space-y-4">
      <h2 className="text-2xl font-semibold tracking-tight">Create Event</h2>

      {/* Stepper */}
      {(phase === "basic" || phase === "questions") && (
        <Stepper currentStep={currentStep} />
      )}

      {/* Step 1: Event Details */}
      {phase === "basic" && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!title || !startsAt) return;
            if (groupActorId && !categoryId) return;
            setPhase("questions");
          }}
          className="space-y-4"
        >
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <HostCard
            groups={groups}
            groupsLoaded={groupsLoaded}
            groupActorId={groupActorId}
            onGroupChange={setGroupActorId}
            onTimezoneInherit={setTimezone}
          />

          <BasicInfoCard
            title={title}
            onTitleChange={setTitle}
            categoryId={categoryId}
            onCategoryChange={setCategoryId}
            categories={categories}
            isGroupEvent={!!groupActorId}
            headerImagePreview={headerImagePreview}
            cropSrc={cropSrc}
            onCropSrcChange={setCropSrc}
            onHeaderImageChange={(blob, preview) => {
              setHeaderImageBlob(blob);
              setHeaderImagePreview(preview);
            }}
            onHeaderImageRemove={() => {
              setHeaderImageBlob(null);
              setHeaderImagePreview(null);
            }}
          />

          <WhenCard
            startsAt={startsAt}
            onStartsAtChange={setStartsAt}
            endsAt={endsAt}
            onEndsAtChange={setEndsAt}
            timezone={timezone}
            onTimezoneChange={setTimezone}
          />

          <DescriptionCard
            description={description}
            onDescriptionChange={setDescription}
          />

          <WhereCard
            selectedPlace={selectedPlace}
            onSelectedPlaceChange={setSelectedPlace}
            venueDetail={venueDetail}
            onVenueDetailChange={setVenueDetail}
            groupActorId={groupActorId || undefined}
          />

          <ExternalUrlCard
            externalUrl={externalUrl}
            onExternalUrlChange={setExternalUrl}
          />

          <MoreOptionsCard
            organizers={organizers}
            searchQuery={searchQuery}
            onSearchQueryChange={setSearchQuery}
            searchResults={searchResults}
            onAddLocalOrganizer={addLocalOrganizer}
            fedHandle={fedHandle}
            onFedHandleChange={setFedHandle}
            resolving={resolving}
            onResolveFediOrganizer={resolveFediOrganizer}
            onRemoveOrganizer={removeOrganizer}
          />

          {/* Info callout */}
          <Alert className="border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-4">
              <path fillRule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-7-4a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM9 9a.75.75 0 0 0 0 1.5h.253a.25.25 0 0 1 .244.304l-.459 2.066A1.75 1.75 0 0 0 10.747 15H11a.75.75 0 0 0 0-1.5h-.253a.25.25 0 0 1-.244-.304l.459-2.066A1.75 1.75 0 0 0 9.253 9H9Z" clipRule="evenodd" />
            </svg>
            <AlertDescription>
              You can edit details after creating the event.
            </AlertDescription>
          </Alert>

          <div className="flex justify-end">
            <Button type="submit">
              Next
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-4 ml-1">
                <path fillRule="evenodd" d="M3 10a.75.75 0 0 1 .75-.75h10.638L10.23 5.29a.75.75 0 1 1 1.04-1.08l5.5 5.25a.75.75 0 0 1 0 1.08l-5.5 5.25a.75.75 0 1 1-1.04-1.08l4.158-3.96H3.75A.75.75 0 0 1 3 10Z" clipRule="evenodd" />
              </svg>
            </Button>
          </div>
        </form>
      )}

      {/* Step 2: Questions */}
      {(phase === "questions" || phase === "submitting") && (
        <QuestionsStep
          questions={questions}
          onQuestionsChange={setQuestions}
          onBack={() => setPhase("basic")}
          onSubmit={submitEvent}
          submitting={phase === "submitting"}
        />
      )}

      {/* Error */}
      {phase === "error" && (
        <Card className="rounded-lg">
          <CardContent className="pt-6 space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <div className="flex gap-3">
              <Button onClick={() => setPhase("questions")}>Retry</Button>
              <Button
                variant="outline"
                onClick={() => {
                  setPhase("basic");
                  setError("");
                }}
              >
                Start over
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </main>
  );
}
