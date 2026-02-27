import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { CATEGORIES } from "~/shared/categories";
import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { Label } from "~/components/ui/label";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Checkbox } from "~/components/ui/checkbox";

export const Route = createFileRoute("/groups/$identifier/edit")({
  component: EditGroupPage,
});

function EditGroupPage() {
  const { identifier } = Route.useParams();
  const navigate = useNavigate();
  const handle = identifier.replace(/^@/, "");

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [name, setName] = useState("");
  const [summary, setSummary] = useState("");
  const [website, setWebsite] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

  useEffect(() => {
    fetch(`/groups/detail?handle=${encodeURIComponent(handle)}`)
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load group");
        return r.json();
      })
      .then((data) => {
        if (!data.currentUserRole) {
          navigate({ to: "/groups/$identifier", params: { identifier } });
          return;
        }
        const g = data.group;
        setName(g.name ?? "");
        setSummary(g.summary ?? "");
        setWebsite(g.website ?? "");
        setSelectedCategories(g.categories ?? []);
        setLoading(false);
      })
      .catch(() => {
        navigate({ to: "/groups/$identifier", params: { identifier } });
      });
  }, [handle, identifier, navigate]);

  function toggleCategory(id: string) {
    setSelectedCategories((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id],
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !summary.trim()) return;

    setSubmitting(true);
    setError("");

    try {
      const res = await fetch("/groups/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          handle,
          name: name.trim(),
          summary: summary.trim(),
          website: website.trim() || undefined,
          categories: selectedCategories,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to update group");
        setSubmitting(false);
        return;
      }
      navigate({
        to: "/groups/$identifier/dashboard",
        params: { identifier },
      });
    } catch {
      setError("Network error");
      setSubmitting(false);
    }
  }

  if (loading) {
    return <p className="text-muted-foreground">Loading...</p>;
  }

  return (
    <main className="mx-auto max-w-xl">
      <h2 className="text-2xl font-semibold tracking-tight mb-6">
        Edit Group
      </h2>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="summary">Description</Label>
            <Textarea
              id="summary"
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
        </div>

        <div className="space-y-2">
          <Label>Categories</Label>
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
        </div>

        <div className="flex gap-3">
          <Button type="submit" disabled={submitting}>
            {submitting ? "Saving..." : "Save Changes"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              navigate({
                to: "/groups/$identifier/dashboard",
                params: { identifier },
              })
            }
          >
            Cancel
          </Button>
        </div>
      </form>
    </main>
  );
}
