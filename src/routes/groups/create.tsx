import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import { CATEGORIES } from "~/shared/categories";
import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { Label } from "~/components/ui/label";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Checkbox } from "~/components/ui/checkbox";
import { Badge } from "~/components/ui/badge";

export const Route = createFileRoute("/groups/create")({
  component: CreateGroupPage,
});

type Phase = "basic" | "categories" | "moderators" | "submitting" | "success" | "error";

type Moderator = {
  handle: string;
  name: string;
  source: "local" | "fediverse";
};

function CreateGroupPage() {
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

  // Basic info
  const [handle, setHandle] = useState("");
  const [name, setName] = useState("");
  const [summary, setSummary] = useState("");
  const [website, setWebsite] = useState("");

  // Categories
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

  // Moderators
  const [moderators, setModerators] = useState<Moderator[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<{ handle: string; displayName: string }[]>([]);
  const [fedHandle, setFedHandle] = useState("");
  const [resolving, setResolving] = useState(false);
  const [createdHandle, setCreatedHandle] = useState("");
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced user search
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }
    searchTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/groups/search-users?q=${encodeURIComponent(searchQuery)}`);
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

  function toggleCategory(id: string) {
    setSelectedCategories((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id],
    );
  }

  function addLocalModerator(user: { handle: string; displayName: string }) {
    if (moderators.some((m) => m.handle === user.handle)) return;
    setModerators((prev) => [
      ...prev,
      { handle: user.handle, name: user.displayName, source: "local" },
    ]);
    setSearchQuery("");
    setSearchResults([]);
  }

  async function resolveFediModerator() {
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
      const normalized = fedHandle.startsWith("@") ? fedHandle.slice(1) : fedHandle;
      if (!moderators.some((m) => m.handle === normalized)) {
        setModerators((prev) => [
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

  function removeModerator(handle: string) {
    setModerators((prev) => prev.filter((m) => m.handle !== handle));
  }

  async function submitGroup() {
    setPhase("submitting");
    setError("");
    try {
      const res = await fetch("/groups/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          handle,
          name,
          summary,
          website: website || undefined,
          categories: selectedCategories,
          moderatorHandles: moderators.map((m) => m.handle),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to create group");
        setPhase("error");
        return;
      }
      setCreatedHandle(data.group.handle);
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
    <main className="max-w-xl">
      <h2 className="text-xl font-semibold mb-4">Create Event Group</h2>

      {phase === "basic" && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!handle || !name || !summary) return;
            setPhase("categories");
          }}
          className="space-y-4"
        >
          {errorBox}
          <div className="space-y-1.5">
            <Label htmlFor="handle">Handle</Label>
            <Input
              id="handle"
              type="text"
              placeholder="tokyo_meetup"
              value={handle}
              onChange={(e) => setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
              required
            />
            <p className="text-sm text-muted-foreground">
              Lowercase letters, numbers, and underscores only
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              type="text"
              placeholder="Tokyo Meetup"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="summary">Description</Label>
            <Textarea
              id="summary"
              placeholder="What is this group about?"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              required
              rows={4}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="website">Website (optional)</Label>
            <Input
              id="website"
              type="url"
              placeholder="https://example.com"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
            />
          </div>
          <Button type="submit">Next</Button>
        </form>
      )}

      {phase === "categories" && (
        <div className="space-y-4">
          <p>Select categories for your group:</p>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-2">
            {CATEGORIES.map((cat) => (
              <label
                key={cat.id}
                className={cn(
                  "flex items-center gap-2 px-2.5 py-1.5 border rounded-md cursor-pointer transition-colors",
                  selectedCategories.includes(cat.id)
                    ? "border-primary bg-primary/5"
                    : "border-border",
                )}
              >
                <Checkbox
                  checked={selectedCategories.includes(cat.id)}
                  onCheckedChange={() => toggleCategory(cat.id)}
                />
                <span className="text-sm">{cat.label}</span>
              </label>
            ))}
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setPhase("basic")}>Back</Button>
            <Button onClick={() => setPhase("moderators")}>Next</Button>
          </div>
        </div>
      )}

      {phase === "moderators" && (
        <div className="space-y-5">
          {errorBox}

          <p>Add moderators (optional):</p>

          {/* Local user search */}
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
                    onClick={() => addLocalModerator(u)}
                    className="px-3 py-2 cursor-pointer hover:bg-accent border-b border-border last:border-b-0"
                  >
                    <strong>{u.displayName}</strong>{" "}
                    <span className="text-muted-foreground">@{u.handle}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Fediverse handle */}
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
                    resolveFediModerator();
                  }
                }}
              />
              <Button onClick={resolveFediModerator} disabled={resolving}>
                {resolving ? "Verifying..." : "Verify"}
              </Button>
            </div>
          </div>

          {/* Selected moderators */}
          {moderators.length > 0 && (
            <div className="space-y-1.5">
              <Label>Selected moderators</Label>
              <ul className="space-y-1">
                {moderators.map((m) => (
                  <li
                    key={m.handle}
                    className="flex items-center justify-between px-3 py-2 border rounded-md"
                  >
                    <span className="flex items-center gap-2">
                      <strong>{m.name}</strong>
                      <span className="text-muted-foreground">@{m.handle}</span>
                      {m.source === "fediverse" && (
                        <Badge variant="secondary">fediverse</Badge>
                      )}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeModerator(m.handle)}
                      className="text-destructive hover:text-destructive"
                    >
                      Remove
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setPhase("categories")}>Back</Button>
            <Button onClick={submitGroup}>Create Group</Button>
          </div>
        </div>
      )}

      {phase === "submitting" && (
        <p className="text-muted-foreground">Creating your group...</p>
      )}

      {phase === "success" && (
        <div className="space-y-4">
          <Alert className="border-green-300 bg-green-50 text-green-800">
            <AlertDescription>Group created successfully!</AlertDescription>
          </Alert>
          <Button
            onClick={() => navigate({ to: "/@/$identifier", params: { identifier: createdHandle } })}
          >
            View Group
          </Button>
        </div>
      )}

      {phase === "error" && (
        <div className="space-y-4">
          {errorBox}
          <div className="flex gap-3">
            <Button onClick={() => setPhase("moderators")}>Retry</Button>
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
