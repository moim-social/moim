import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { CATEGORIES } from "~/shared/categories";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { Label } from "~/components/ui/label";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Badge } from "~/components/ui/badge";
import { Checkbox } from "~/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "~/components/ui/tabs";

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

function CreateEventPage() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>("basic");
  const [error, setError] = useState("");

  // Auth guard
  const [authed, setAuthed] = useState<boolean | null>(null);
  useEffect(() => {
    fetch("/auth/me")
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
    fetch("/groups/my-groups")
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
  const [location, setLocation] = useState("");
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
          `/groups/search-users?q=${encodeURIComponent(searchQuery)}`,
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
      const res = await fetch("/groups/resolve-moderator", {
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
      const res = await fetch("/events/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description: description || undefined,
          location: location || undefined,
          categoryId,
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
      setPhase("success");
    } catch {
      setError("Network error");
      setPhase("error");
    }
  }

  if (authed === null) {
    return <p className="text-muted-foreground">Loading...</p>;
  }

  const errorBox = error && (
    <Alert variant="destructive" className="mb-4">
      <AlertDescription>{error}</AlertDescription>
    </Alert>
  );

  return (
    <main className="mx-auto max-w-xl">
      <h2 className="text-2xl font-semibold tracking-tight mb-6">
        Create Event
      </h2>

      {phase === "basic" && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!title || !categoryId || !startsAt) return;
            setPhase("questions");
          }}
          className="space-y-5"
        >
          {errorBox}

          <div className="space-y-1.5">
            <Label>Host</Label>
            {!groupsLoaded ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : (
              <Tabs
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

          <div className="space-y-1.5">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              type="text"
              placeholder="Event title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

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

          <div className="space-y-1.5">
            <Label htmlFor="categoryId">Category</Label>
            <select
              id="categoryId"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              required
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

          <div className="space-y-1.5">
            <Label htmlFor="location">Location (optional)</Label>
            <Input
              id="location"
              type="text"
              placeholder="e.g. Shibuya Stream, Tokyo"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="startsAt">Start time</Label>
              <Input
                id="startsAt"
                type="datetime-local"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="endsAt">End time (optional)</Label>
              <Input
                id="endsAt"
                type="datetime-local"
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
              />
            </div>
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

          <Button type="submit">Next</Button>
        </form>
      )}

      {phase === "questions" && (
        <div className="space-y-5">
          <p className="text-muted-foreground">
            Add questions that participants will answer when RSVPing. You can skip this step.
          </p>

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

          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setPhase("basic")}>Back</Button>
            <Button onClick={submitEvent}>Create Event</Button>
          </div>
        </div>
      )}

      {phase === "submitting" && (
        <p className="text-muted-foreground">Creating your event...</p>
      )}

      {phase === "success" && (
        <div className="space-y-4">
          <Alert className="border-green-300 bg-green-50 text-green-800">
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
        </div>
      )}

      {phase === "error" && (
        <div className="space-y-4">
          {errorBox}
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
        </div>
      )}
    </main>
  );
}
