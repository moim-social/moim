import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { PlaceCategorySelect } from "~/components/PlaceCategorySelect";
import { type PlaceCategoryOption, resolveCategoryLabel } from "~/lib/place";
import { EmptyState, PageHeader } from "~/components/dashboard";
import { useGroupDashboard, type GroupData } from "./route";

export const Route = createFileRoute("/groups/$identifier/dashboard/places")({
  component: PlacesTab,
});

type PlaceFormState = {
  name: string;
  categoryId: string;
  description: string;
  address: string;
  website: string;
};

function PlacesTab() {
  const navigate = useNavigate();
  const { data } = useGroupDashboard();
  const { places } = data;
  const groupId = data.group.id;

  const [editingPlace, setEditingPlace] = useState<
    GroupData["places"][number] | null
  >(null);
  const [form, setForm] = useState<PlaceFormState>({
    name: "",
    categoryId: "",
    description: "",
    address: "",
    website: "",
  });
  const [options, setOptions] = useState<PlaceCategoryOption[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openEdit = (place: GroupData["places"][number]) => {
    setEditingPlace(place);
    setError(null);
    setForm({
      name: place.name,
      categoryId: place.category?.slug ?? "",
      description: place.description ?? "",
      address: place.address ?? "",
      website: "",
    });
    fetch("/api/place-categories")
      .then((r) => r.json())
      .then((data) => setOptions(data.options ?? []))
      .catch(() => {});
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPlace) return;
    setSaving(true);
    setError(null);

    const res = await fetch(
      `/api/groups/${groupId}/places/${editingPlace.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name || undefined,
          categoryId: form.categoryId || null,
          description: form.description || undefined,
          address: form.address || undefined,
          website: form.website || undefined,
        }),
      },
    );

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Failed to update place");
      setSaving(false);
      return;
    }

    setSaving(false);
    setEditingPlace(null);
    navigate({ to: "/places/$placeId", params: { placeId: editingPlace.id } });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Places"
        subtitle={`${places.length} places assigned to this group.`}
      />

      {places.length === 0 ? (
        <EmptyState message="No places assigned to this group yet." />
      ) : (
        <div className="space-y-1.5">
          {places.map((place) => (
            <div
              key={place.id}
              className="flex items-center gap-3 rounded-md border p-3 hover:bg-accent/50 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <Link
                  to="/places/$placeId"
                  params={{ placeId: place.id }}
                  className="text-sm font-medium hover:underline hover:text-primary"
                >
                  {place.name}
                </Link>
                {place.address && (
                  <span className="text-xs text-muted-foreground ml-2">
                    {place.address}
                  </span>
                )}
                {place.description && (
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                    {place.description}
                  </p>
                )}
              </div>
              {place.category && (
                <Badge variant="secondary" className="text-xs shrink-0">
                  {`${place.category.emoji ?? ""} ${place.category.label ? resolveCategoryLabel(place.category as { label: string; labels?: Record<string, string> }) : ""}`.trim()}
                </Badge>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => openEdit(place)}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="size-4"
                >
                  <path d="m5.433 13.917 1.262-3.155A4 4 0 0 1 7.58 9.42l6.92-6.918a2.121 2.121 0 0 1 3 3l-6.92 6.918c-.383.383-.84.685-1.343.886l-3.154 1.262a.5.5 0 0 1-.65-.65Z" />
                  <path d="M3.5 5.75c0-.69.56-1.25 1.25-1.25H10A.75.75 0 0 0 10 3H4.75A2.75 2.75 0 0 0 2 5.75v9.5A2.75 2.75 0 0 0 4.75 18h9.5A2.75 2.75 0 0 0 17 15.25V10a.75.75 0 0 0-1.5 0v5.25c0 .69-.56 1.25-1.25 1.25h-9.5c-.69 0-1.25-.56-1.25-1.25v-9.5Z" />
                </svg>
              </Button>
            </div>
          ))}
        </div>
      )}

      <Dialog
        open={editingPlace != null}
        onOpenChange={(open) => !open && setEditingPlace(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Place</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="place-name">Name</Label>
              <Input
                id="place-name"
                value={form.name}
                onChange={(e) =>
                  setForm((c) => ({ ...c, name: e.target.value }))
                }
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="place-category">Category</Label>
              <PlaceCategorySelect
                id="place-category"
                value={form.categoryId}
                onChange={(value) =>
                  setForm((c) => ({ ...c, categoryId: value }))
                }
                options={options}
                emptyLabel="Uncategorized"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="place-description">Description</Label>
              <Textarea
                id="place-description"
                value={form.description}
                onChange={(e) =>
                  setForm((c) => ({ ...c, description: e.target.value }))
                }
                rows={3}
                placeholder="About this place..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="place-address">Address</Label>
              <Input
                id="place-address"
                value={form.address}
                onChange={(e) =>
                  setForm((c) => ({ ...c, address: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="place-website">Website</Label>
              <Input
                id="place-website"
                value={form.website}
                onChange={(e) =>
                  setForm((c) => ({ ...c, website: e.target.value }))
                }
                placeholder="https://example.com"
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditingPlace(null)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
