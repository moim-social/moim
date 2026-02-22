import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import { CATEGORIES } from "~/shared/categories";

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
    return <p>Loading...</p>;
  }

  const errorBox = error && (
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
  );

  return (
    <main style={{ maxWidth: 600 }}>
      <h2>Create Event Group</h2>

      {phase === "basic" && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!handle || !name || !summary) return;
            setPhase("categories");
          }}
        >
          {errorBox}
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", marginBottom: 4, fontWeight: 600 }}>
              Handle
            </label>
            <input
              type="text"
              placeholder="tokyo_meetup"
              value={handle}
              onChange={(e) => setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
              required
              style={inputStyle}
            />
            <small style={{ color: "#666" }}>
              Lowercase letters, numbers, and underscores only
            </small>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", marginBottom: 4, fontWeight: 600 }}>
              Name
            </label>
            <input
              type="text"
              placeholder="Tokyo Meetup"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              style={inputStyle}
            />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", marginBottom: 4, fontWeight: 600 }}>
              Description
            </label>
            <textarea
              placeholder="What is this group about?"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              required
              rows={4}
              style={{ ...inputStyle, resize: "vertical" }}
            />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", marginBottom: 4, fontWeight: 600 }}>
              Website (optional)
            </label>
            <input
              type="url"
              placeholder="https://example.com"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              style={inputStyle}
            />
          </div>
          <button type="submit" style={btnStyle}>
            Next
          </button>
        </form>
      )}

      {phase === "categories" && (
        <div>
          <p style={{ marginBottom: 12 }}>Select categories for your group:</p>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
              gap: 8,
              marginBottom: 24,
            }}
          >
            {CATEGORIES.map((cat) => (
              <label
                key={cat.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "6px 10px",
                  border: `1px solid ${selectedCategories.includes(cat.id) ? "#2563eb" : "#d1d5db"}`,
                  borderRadius: 6,
                  cursor: "pointer",
                  background: selectedCategories.includes(cat.id) ? "#eff6ff" : "transparent",
                }}
              >
                <input
                  type="checkbox"
                  checked={selectedCategories.includes(cat.id)}
                  onChange={() => toggleCategory(cat.id)}
                />
                {cat.label}
              </label>
            ))}
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <button onClick={() => setPhase("basic")} style={btnSecondaryStyle}>
              Back
            </button>
            <button onClick={() => setPhase("moderators")} style={btnStyle}>
              Next
            </button>
          </div>
        </div>
      )}

      {phase === "moderators" && (
        <div>
          {errorBox}

          <p style={{ marginBottom: 12 }}>Add moderators (optional):</p>

          {/* Local user search */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: "block", marginBottom: 4, fontWeight: 600 }}>
              Search registered users
            </label>
            <input
              type="text"
              placeholder="Search by name or handle..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={inputStyle}
            />
            {searchResults.length > 0 && (
              <ul
                style={{
                  listStyle: "none",
                  margin: "4px 0 0",
                  padding: 0,
                  border: "1px solid #d1d5db",
                  borderRadius: 6,
                  maxHeight: 200,
                  overflow: "auto",
                }}
              >
                {searchResults.map((u) => (
                  <li
                    key={u.handle}
                    onClick={() => addLocalModerator(u)}
                    style={{
                      padding: "8px 12px",
                      cursor: "pointer",
                      borderBottom: "1px solid #f3f4f6",
                    }}
                  >
                    <strong>{u.displayName}</strong>{" "}
                    <span style={{ color: "#6b7280" }}>@{u.handle}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Fediverse handle */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: "block", marginBottom: 4, fontWeight: 600 }}>
              Add by fediverse handle
            </label>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                type="text"
                placeholder="@user@mastodon.social"
                value={fedHandle}
                onChange={(e) => setFedHandle(e.target.value)}
                style={{ ...inputStyle, flex: 1 }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    resolveFediModerator();
                  }
                }}
              />
              <button
                onClick={resolveFediModerator}
                disabled={resolving}
                style={btnStyle}
              >
                {resolving ? "Verifying..." : "Verify"}
              </button>
            </div>
          </div>

          {/* Selected moderators */}
          {moderators.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "block", marginBottom: 4, fontWeight: 600 }}>
                Selected moderators
              </label>
              <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {moderators.map((m) => (
                  <li
                    key={m.handle}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "8px 12px",
                      border: "1px solid #d1d5db",
                      borderRadius: 6,
                      marginBottom: 4,
                    }}
                  >
                    <span>
                      <strong>{m.name}</strong>{" "}
                      <span style={{ color: "#6b7280" }}>@{m.handle}</span>
                      {m.source === "fediverse" && (
                        <span
                          style={{
                            fontSize: 11,
                            background: "#dbeafe",
                            color: "#1e40af",
                            padding: "2px 6px",
                            borderRadius: 4,
                            marginLeft: 8,
                          }}
                        >
                          fediverse
                        </span>
                      )}
                    </span>
                    <button
                      onClick={() => removeModerator(m.handle)}
                      style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        color: "#ef4444",
                        fontSize: 16,
                      }}
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div style={{ display: "flex", gap: 12 }}>
            <button onClick={() => setPhase("categories")} style={btnSecondaryStyle}>
              Back
            </button>
            <button onClick={submitGroup} style={btnStyle}>
              Create Group
            </button>
          </div>
        </div>
      )}

      {phase === "submitting" && <p>Creating your group...</p>}

      {phase === "success" && (
        <div>
          <div
            style={{
              background: "#f0fdf4",
              border: "1px solid #86efac",
              borderRadius: 8,
              padding: "12px 16px",
              marginBottom: 16,
              color: "#166534",
            }}
          >
            Group created successfully!
          </div>
          <button
            onClick={() => navigate({ to: "/@/$identifier", params: { identifier: createdHandle } })}
            style={btnStyle}
          >
            View Group
          </button>
        </div>
      )}

      {phase === "error" && (
        <div>
          {errorBox}
          <div style={{ display: "flex", gap: 12 }}>
            <button onClick={() => setPhase("moderators")} style={btnStyle}>
              Retry
            </button>
            <button
              onClick={() => {
                setPhase("basic");
                setError("");
              }}
              style={btnSecondaryStyle}
            >
              Start over
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 12px",
  fontSize: 16,
  boxSizing: "border-box",
  border: "1px solid #d1d5db",
  borderRadius: 6,
};

const btnStyle: React.CSSProperties = {
  padding: "8px 24px",
  fontSize: 16,
  background: "#2563eb",
  color: "#fff",
  border: "none",
  borderRadius: 6,
  cursor: "pointer",
};

const btnSecondaryStyle: React.CSSProperties = {
  padding: "8px 24px",
  fontSize: 16,
  background: "#f3f4f6",
  color: "#374151",
  border: "1px solid #d1d5db",
  borderRadius: 6,
  cursor: "pointer",
};
