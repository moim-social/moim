import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import { usePostHog } from "posthog-js/react";
import { useEventCategories } from "~/hooks/useEventCategories";
import { resolveCategoryLabel } from "~/lib/place";
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

const STEPS = ["Group Info", "Categories", "Moderators"] as const;

function Stepper({ currentStep }: { currentStep: number }) {
  return (
    <div className="flex">
      {STEPS.map((label, idx) => {
        const isCompleted = idx < currentStep;
        const isActive = idx === currentStep;
        return (
          <div key={label} className="flex-1 text-center">
            <div className={`text-[11px] font-semibold uppercase tracking-wide pb-2 ${
              isCompleted || isActive ? "font-extrabold text-foreground" : "text-[#bbb]"
            }`}>
              {idx + 1} &middot; {label}
            </div>
            <div className={`h-[3px] ${isCompleted || isActive ? "bg-foreground" : "bg-[#e5e5e5]"}`} />
          </div>
        );
      })}
    </div>
  );
}

function CreateGroupPage() {
  const { categories } = useEventCategories();
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
          navigate({ to: "/auth/signin", search: { returnTo: "/groups/create" } });
        } else {
          setAuthed(true);
        }
      })
      .catch(() => navigate({ to: "/auth/signin", search: { returnTo: "/groups/create" } }));
  }, [navigate]);

  // Basic info
  const [handle, setHandle] = useState("");
  const [name, setName] = useState("");
  const [summary, setSummary] = useState("");
  const [website, setWebsite] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

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
        const res = await fetch(`/api/users?query=${encodeURIComponent(searchQuery)}`);
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
      const res = await fetch("/api/groups", {
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

      // Upload avatar if selected
      if (avatarFile) {
        try {
          const formData = new FormData();
          formData.append("handle", data.group.handle);
          formData.append("avatar", avatarFile);
          await fetch(`/api/groups/${data.group.id}/avatar`, { method: "POST", body: formData });
        } catch {
          // Avatar upload failure is non-blocking
        }
      }

      posthog?.capture("group_created", { handle: data.group.handle });
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
    : phase === "categories" ? 1
    : phase === "moderators" ? 2
    : phase === "submitting" ? 2
    : phase === "success" ? 3
    : 2;

  const errorBox = error && (
    <Alert variant="destructive">
      <AlertDescription>{error}</AlertDescription>
    </Alert>
  );

  return (
    <main className="mx-auto max-w-2xl space-y-6">
      <div className="pb-4 border-b-2 border-foreground">
        <h2 className="text-2xl font-extrabold tracking-tight">Create Group</h2>
      </div>

      {/* Stepper */}
      {(phase === "basic" || phase === "categories" || phase === "moderators") && (
        <Stepper currentStep={currentStep} />
      )}

      {/* Step 1: Group Info */}
      {phase === "basic" && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!handle || !name || !summary) return;
            setPhase("categories");
          }}
          className="space-y-5"
        >
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wide text-[#333]">Group Information</h3>
            <p className="text-[13px] text-[#888] mt-1">
              Set up the basic details for your event group.
            </p>
          </div>

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
              <div className="space-y-1.5">
                <Label htmlFor="avatar">Profile Image (optional)</Label>
                <div className="flex items-center gap-4">
                  {avatarPreview ? (
                    <img
                      src={avatarPreview}
                      alt="Avatar preview"
                      className="size-16 rounded-full object-cover"
                    />
                  ) : (
                    <div className="size-16 rounded-full bg-muted flex items-center justify-center text-muted-foreground text-xl font-semibold">
                      {name ? name.charAt(0).toUpperCase() : "?"}
                    </div>
                  )}
                  <div className="flex-1">
                    <Input
                      id="avatar"
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0] ?? null;
                        setAvatarFile(file);
                        if (file) {
                          setAvatarPreview(URL.createObjectURL(file));
                        } else {
                          setAvatarPreview(null);
                        }
                      }}
                    />
                    <p className="text-sm text-muted-foreground mt-1">
                      Max 5MB. Will be resized to 256x256.
                    </p>
                  </div>
                </div>
              </div>

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

      {/* Step 2: Categories */}
      {phase === "categories" && (
        <div className="space-y-5">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wide text-[#333]">Categories</h3>
            <p className="text-[13px] text-[#888] mt-1">
              Select categories that best describe your group's focus.
            </p>
          </div>

              <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-2">
                {categories.map((cat) => (
                  <label
                    key={cat.slug}
                    className={cn(
                      "flex items-center gap-2 px-2.5 py-1.5 border rounded-md cursor-pointer transition-colors",
                      selectedCategories.includes(cat.slug)
                        ? "border-primary bg-primary/5"
                        : "border-border",
                    )}
                  >
                    <Checkbox
                      checked={selectedCategories.includes(cat.slug)}
                      onCheckedChange={() => toggleCategory(cat.slug)}
                    />
                    <span className="text-sm">{resolveCategoryLabel(cat)}</span>
                  </label>
                ))}
              </div>

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setPhase("basic")}>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-4 mr-1">
                    <path fillRule="evenodd" d="M17 10a.75.75 0 0 1-.75.75H5.612l4.158 3.96a.75.75 0 1 1-1.04 1.08l-5.5-5.25a.75.75 0 0 1 0-1.08l5.5-5.25a.75.75 0 1 1 1.04 1.08L5.612 9.25H16.25A.75.75 0 0 1 17 10Z" clipRule="evenodd" />
                  </svg>
                  Back
                </Button>
                <Button onClick={() => setPhase("moderators")}>
                  Next
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-4 ml-1">
                    <path fillRule="evenodd" d="M3 10a.75.75 0 0 1 .75-.75h10.638L10.23 5.29a.75.75 0 1 1 1.04-1.08l5.5 5.25a.75.75 0 0 1 0 1.08l-5.5 5.25a.75.75 0 1 1-1.04-1.08l4.158-3.96H3.75A.75.75 0 0 1 3 10Z" clipRule="evenodd" />
                  </svg>
                </Button>
              </div>
        </div>
      )}

      {/* Step 3: Moderators */}
      {phase === "moderators" && (
        <div className="space-y-5">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wide text-[#333]">Moderators</h3>
            <p className="text-[13px] text-[#888] mt-1">
              Add moderators who will help manage this group.
            </p>
          </div>

              {errorBox}

              {/* Info callout */}
              <Alert className="border-[#e5e5e5] bg-[#fafafa] text-[#555]">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-4">
                  <path fillRule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-7-4a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM9 9a.75.75 0 0 0 0 1.5h.253a.25.25 0 0 1 .244.304l-.459 2.066A1.75 1.75 0 0 0 10.747 15H11a.75.75 0 0 0 0-1.5h-.253a.25.25 0 0 1-.244-.304l.459-2.066A1.75 1.75 0 0 0 9.253 9H9Z" clipRule="evenodd" />
                </svg>
                <AlertDescription>
                  You can add or change moderators later from the group dashboard.
                </AlertDescription>
              </Alert>

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
                  <Button type="button" onClick={resolveFediModerator} disabled={resolving}>
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
                          type="button"
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

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setPhase("categories")}>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-4 mr-1">
                    <path fillRule="evenodd" d="M17 10a.75.75 0 0 1-.75.75H5.612l4.158 3.96a.75.75 0 1 1-1.04 1.08l-5.5-5.25a.75.75 0 0 1 0-1.08l5.5-5.25a.75.75 0 1 1 1.04 1.08L5.612 9.25H16.25A.75.75 0 0 1 17 10Z" clipRule="evenodd" />
                  </svg>
                  Back
                </Button>
                <Button onClick={submitGroup}>
                  Create Group
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-4 ml-1">
                    <path fillRule="evenodd" d="M3 10a.75.75 0 0 1 .75-.75h10.638L10.23 5.29a.75.75 0 1 1 1.04-1.08l5.5 5.25a.75.75 0 0 1 0 1.08l-5.5 5.25a.75.75 0 1 1-1.04-1.08l4.158-3.96H3.75A.75.75 0 0 1 3 10Z" clipRule="evenodd" />
                  </svg>
                </Button>
              </div>
        </div>
      )}

      {/* Submitting */}
      {phase === "submitting" && (
        <div className="py-16 text-center">
          <p className="text-muted-foreground">Creating your group...</p>
        </div>
      )}

      {/* Success */}
      {phase === "success" && (
        <div className="space-y-4">
          <Alert className="border-[#e5e5e5] bg-[#fafafa] text-[#333]">
            <AlertDescription>Group created successfully!</AlertDescription>
          </Alert>
          <div className="flex gap-3">
            <Button
              onClick={() => navigate({ to: "/groups/$identifier/dashboard", params: { identifier: `@${createdHandle}` } })}
            >
              Go to Dashboard
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate({ to: "/groups/$identifier", params: { identifier: `@${createdHandle}` } })}
            >
              View Public Page
            </Button>
          </div>
        </div>
      )}

      {/* Error */}
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
