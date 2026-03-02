import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { usePostHog } from "posthog-js/react";
import { CATEGORIES } from "~/shared/categories";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { Label } from "~/components/ui/label";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Badge } from "~/components/ui/badge";
import { Checkbox } from "~/components/ui/checkbox";
import { Card, CardContent } from "~/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "~/components/ui/tabs";
import { PlacePicker, type SelectedPlace } from "~/components/PlacePicker";

export const Route = createFileRoute("/events/create")({
  component: CreateEventPage,
});

type Phase = "basic" | "questions" | "submitting" | "success" | "error";

type Organizer = {
  handle: string;
  name: string;
  source: "local" | "fediverse";
};

type QuestionDraft = {
  question: string;
  required: boolean;
};

const STEPS = ["Event Details", "Questions / Create"] as const;

function Stepper({ currentStep }: { currentStep: number }) {
  return (
    <Card className="rounded-lg">
      <CardContent className="py-5">
        <div className="relative flex justify-between">
          {/* Connecting line behind circles */}
          <div className="absolute top-4 left-0 right-0 flex items-center px-12">
            <div className={`h-px flex-1 ${currentStep > 0 ? "bg-primary" : "bg-border"}`} />
          </div>
          {STEPS.map((label, idx) => {
            const isCompleted = idx < currentStep;
            const isActive = idx === currentStep;
            return (
              <div key={label} className="relative z-10 flex flex-col items-center gap-1.5">
                <div
                  className={`size-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    isCompleted || isActive
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {isCompleted ? (
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-4">
                      <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    <span>{String(idx + 1).padStart(2, "0")}</span>
                  )}
                </div>
                <span
                  className={`text-xs whitespace-nowrap ${
                    isActive || isCompleted ? "font-medium text-foreground" : "text-muted-foreground"
                  }`}
                >
                  {label}
                </span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function CreateEventPage() {
  const navigate = useNavigate();
  const posthog = usePostHog();
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
    { id: string; handle: string; name: string | null }[]
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
  const [externalUrl, setExternalUrl] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");

  // Organizers
  const [organizers, setOrganizers] = useState<Organizer[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<
    { handle: string; displayName: string }[]
  >([]);
  const [fedHandle, setFedHandle] = useState("");
  const [resolving, setResolving] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Survey questions
  const [questions, setQuestions] = useState<QuestionDraft[]>([]);
  const [createdEventId, setCreatedEventId] = useState("");

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
          externalUrl: externalUrl || undefined,
          categoryId: categoryId || undefined,
          groupActorId: groupActorId || undefined,
          startsAt: new Date(startsAt).toISOString(),
          endsAt: endsAt ? new Date(endsAt).toISOString() : undefined,
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
      setCreatedEventId(data.event.id);
      posthog?.capture("event_created", { eventId: data.event.id });
      setPhase("success");
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
    : phase === "success" ? 2
    : 1;

  return (
    <main className="mx-auto max-w-2xl space-y-6">
      <h2 className="text-2xl font-semibold tracking-tight">Create Event</h2>

      {/* Stepper */}
      {(phase === "basic" || phase === "questions") && (
        <Stepper currentStep={currentStep} />
      )}

      {/* Step 1: Event Details */}
      {phase === "basic" && (
        <Card className="rounded-lg">
          <CardContent className="pt-6">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!title || !startsAt) return;
                if (groupActorId && !categoryId) return;
                setPhase("questions");
              }}
              className="space-y-6"
            >
              <div>
                <h3 className="text-lg font-semibold">Event Details</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Fill in the basic information for your event.
                </p>
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {/* Host */}
              <div className="space-y-1.5">
                <Label>Host</Label>
                {!groupsLoaded ? (
                  <p className="text-sm text-muted-foreground">Loading...</p>
                ) : (
                  <Tabs
                    defaultValue="personal"
                    value={groupActorId ? "group" : "personal"}
                    onValueChange={(v) => {
                      if (v === "personal") {
                        setGroupActorId("");
                      } else if (v === "group" && groups.length > 0 && !groupActorId) {
                        setGroupActorId(groups[0].id);
                      }
                    }}
                  >
                    <TabsList>
                      <TabsTrigger value="personal">Personal</TabsTrigger>
                      <TabsTrigger value="group" disabled={groups.length === 0}>
                        Group{groups.length === 0 ? "" : ` (${groups.length})`}
                      </TabsTrigger>
                    </TabsList>
                    <TabsContent value="personal">
                      <p className="text-sm text-muted-foreground mt-1">
                        This event will be hosted under your personal account.
                      </p>
                    </TabsContent>
                    <TabsContent value="group">
                      {groups.length === 0 ? (
                        <p className="text-sm text-muted-foreground mt-1">
                          You don't belong to any groups yet.
                        </p>
                      ) : (
                        <select
                          value={groupActorId}
                          onChange={(e) => setGroupActorId(e.target.value)}
                          className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        >
                          <option value="">Select a group</option>
                          {groups.map((g) => (
                            <option key={g.id} value={g.id}>
                              {g.name ?? g.handle}
                            </option>
                          ))}
                        </select>
                      )}
                    </TabsContent>
                  </Tabs>
                )}
              </div>

              {/* Category */}
              <div className="space-y-1.5">
                <Label htmlFor="categoryId">
                  Category{!groupActorId && " (optional)"}
                  {groupActorId && <span className="text-destructive ml-1">*</span>}
                </Label>
                <select
                  id="categoryId"
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  required={!!groupActorId}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <option value="">Select a category</option>
                  {CATEGORIES.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Title */}
              <div className="space-y-1.5">
                <Label htmlFor="title">
                  Title <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="title"
                  type="text"
                  placeholder="Event title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>

              {/* Info callout */}
              <Alert className="border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-4">
                  <path fillRule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-7-4a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM9 9a.75.75 0 0 0 0 1.5h.253a.25.25 0 0 1 .244.304l-.459 2.066A1.75 1.75 0 0 0 10.747 15H11a.75.75 0 0 0 0-1.5h-.253a.25.25 0 0 1-.244-.304l.459-2.066A1.75 1.75 0 0 0 9.253 9H9Z" clipRule="evenodd" />
                </svg>
                <AlertDescription>
                  You can edit the description and other details after creating the event.
                </AlertDescription>
              </Alert>

              {/* Description */}
              <div className="space-y-1.5">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="What is this event about?"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                />
              </div>

              {/* Date range */}
              <div className="space-y-1.5">
                <Label>
                  Event period <span className="text-destructive">*</span>
                </Label>
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    id="startsAt"
                    type="datetime-local"
                    value={startsAt}
                    onChange={(e) => setStartsAt(e.target.value)}
                    required
                  />
                  <Input
                    id="endsAt"
                    type="datetime-local"
                    value={endsAt}
                    onChange={(e) => setEndsAt(e.target.value)}
                  />
                </div>
                <p className="text-xs text-muted-foreground">End time is optional.</p>
              </div>

              {/* Location */}
              <div className="space-y-1.5">
                <Label>Location (optional)</Label>
                <PlacePicker
                  value={selectedPlace}
                  onChange={setSelectedPlace}
                />
              </div>

              {/* External registration URL */}
              <div className="space-y-1.5">
                <Label htmlFor="externalUrl">External registration URL (optional)</Label>
                <Input
                  id="externalUrl"
                  type="url"
                  placeholder="https://eventbrite.com/e/..."
                  value={externalUrl}
                  onChange={(e) => setExternalUrl(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Attendees will be directed to this URL instead of the built-in RSVP.
                </p>
              </div>

              {/* Organizers section */}
              <fieldset className="space-y-3">
                <legend className="text-sm font-medium">
                  Organizers (optional)
                </legend>

                <div className="space-y-1.5">
                  <Label>Search registered users</Label>
                  <Input
                    type="text"
                    placeholder="Search by name or handle..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                  {searchResults.length > 0 && (
                    <ul className="mt-1 border rounded-md max-h-[200px] overflow-auto">
                      {searchResults.map((u) => (
                        <li
                          key={u.handle}
                          onClick={() => addLocalOrganizer(u)}
                          className="px-3 py-2 cursor-pointer hover:bg-accent border-b border-border last:border-b-0"
                        >
                          <strong>{u.displayName}</strong>{" "}
                          <span className="text-muted-foreground">@{u.handle}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label>Add by fediverse handle</Label>
                  <div className="flex gap-2">
                    <Input
                      type="text"
                      placeholder="@user@mastodon.social"
                      value={fedHandle}
                      onChange={(e) => setFedHandle(e.target.value)}
                      className="flex-1"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          resolveFediOrganizer();
                        }
                      }}
                    />
                    <Button
                      type="button"
                      onClick={resolveFediOrganizer}
                      disabled={resolving}
                    >
                      {resolving ? "Verifying..." : "Verify"}
                    </Button>
                  </div>
                </div>

                {organizers.length > 0 && (
                  <ul className="space-y-1">
                    {organizers.map((o) => (
                      <li
                        key={o.handle}
                        className="flex items-center justify-between px-3 py-2 border rounded-md"
                      >
                        <span className="flex items-center gap-2">
                          <strong>{o.name}</strong>
                          <span className="text-muted-foreground">
                            @{o.handle}
                          </span>
                          {o.source === "fediverse" && (
                            <Badge variant="secondary">fediverse</Badge>
                          )}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeOrganizer(o.handle)}
                          className="text-destructive hover:text-destructive"
                        >
                          Remove
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </fieldset>

              <div className="flex justify-end">
                <Button type="submit">
                  Next
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-4 ml-1">
                    <path fillRule="evenodd" d="M3 10a.75.75 0 0 1 .75-.75h10.638L10.23 5.29a.75.75 0 1 1 1.04-1.08l5.5 5.25a.75.75 0 0 1 0 1.08l-5.5 5.25a.75.75 0 1 1-1.04-1.08l4.158-3.96H3.75A.75.75 0 0 1 3 10Z" clipRule="evenodd" />
                  </svg>
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Questions */}
      {phase === "questions" && (
        <Card className="rounded-lg">
          <CardContent className="pt-6">
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold">RSVP Questions</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Add questions that participants will answer when RSVPing. You can skip this step.
                </p>
              </div>

              {questions.map((q, idx) => (
                <div key={idx} className="flex items-start gap-3 border rounded-md p-3">
                  <div className="flex-1 space-y-2">
                    <Input
                      placeholder={`Question ${idx + 1}`}
                      value={q.question}
                      onChange={(e) => {
                        const updated = [...questions];
                        updated[idx] = { ...updated[idx], question: e.target.value };
                        setQuestions(updated);
                      }}
                    />
                    <label className="flex items-center gap-2">
                      <Checkbox
                        checked={q.required}
                        onCheckedChange={(checked) => {
                          const updated = [...questions];
                          updated[idx] = { ...updated[idx], required: !!checked };
                          setQuestions(updated);
                        }}
                      />
                      <span className="text-sm">Required</span>
                    </label>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setQuestions(questions.filter((_, i) => i !== idx))}
                  >
                    Remove
                  </Button>
                </div>
              ))}

              <Button
                type="button"
                variant="outline"
                onClick={() => setQuestions([...questions, { question: "", required: false }])}
              >
                + Add Question
              </Button>

              {/* Info callout */}
              <Alert className="border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-4">
                  <path fillRule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-7-4a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM9 9a.75.75 0 0 0 0 1.5h.253a.25.25 0 0 1 .244.304l-.459 2.066A1.75 1.75 0 0 0 10.747 15H11a.75.75 0 0 0 0-1.5h-.253a.25.25 0 0 1-.244-.304l.459-2.066A1.75 1.75 0 0 0 9.253 9H9Z" clipRule="evenodd" />
                </svg>
                <AlertDescription>
                  You can add or edit questions after creating the event as well.
                </AlertDescription>
              </Alert>

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setPhase("basic")}>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-4 mr-1">
                    <path fillRule="evenodd" d="M17 10a.75.75 0 0 1-.75.75H5.612l4.158 3.96a.75.75 0 1 1-1.04 1.08l-5.5-5.25a.75.75 0 0 1 0-1.08l5.5-5.25a.75.75 0 1 1 1.04 1.08L5.612 9.25H16.25A.75.75 0 0 1 17 10Z" clipRule="evenodd" />
                  </svg>
                  Back
                </Button>
                <Button onClick={submitEvent}>
                  Create Event
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-4 ml-1">
                    <path fillRule="evenodd" d="M3 10a.75.75 0 0 1 .75-.75h10.638L10.23 5.29a.75.75 0 1 1 1.04-1.08l5.5 5.25a.75.75 0 0 1 0 1.08l-5.5 5.25a.75.75 0 1 1-1.04-1.08l4.158-3.96H3.75A.75.75 0 0 1 3 10Z" clipRule="evenodd" />
                  </svg>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Submitting */}
      {phase === "submitting" && (
        <Card className="rounded-lg">
          <CardContent className="py-16 text-center">
            <p className="text-muted-foreground">Creating your event...</p>
          </CardContent>
        </Card>
      )}

      {/* Success */}
      {phase === "success" && (
        <Card className="rounded-lg">
          <CardContent className="pt-6 space-y-4">
            <Alert className="border-green-300 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-200">
              <AlertDescription>Event created successfully!</AlertDescription>
            </Alert>
            <div className="flex gap-3">
              <Button
                onClick={() => navigate({ to: "/events/$eventId", params: { eventId: createdEventId } })}
              >
                View Event
              </Button>
              <Button variant="outline" onClick={() => navigate({ to: "/events" })}>
                Browse Events
              </Button>
            </div>
          </CardContent>
        </Card>
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
