import { useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Search, Pencil } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Textarea } from "~/components/ui/textarea";
import { PlaceCategorySelect } from "~/components/PlaceCategorySelect";
import type { PlaceCategoryOption, PlaceCategorySummary } from "~/lib/place";

export const Route = createFileRoute("/admin/places/")({
  component: AdminPlacesPage,
});

type AdminPlaceRow = {
  id: string;
  name: string;
  description: string | null;
  address: string | null;
  website: string | null;
  createdAt: string;
  checkinCount: number;
  category: PlaceCategorySummary | null;
};

type PlaceFormState = {
  categoryId: string;
  description: string;
  address: string;
  website: string;
};

const emptyForm: PlaceFormState = {
  categoryId: "",
  description: "",
  address: "",
  website: "",
};

function AdminPlacesPage() {
  const [places, setPlaces] = useState<AdminPlaceRow[]>([]);
  const [options, setOptions] = useState<PlaceCategoryOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [editingPlace, setEditingPlace] = useState<AdminPlaceRow | null>(null);
  const [form, setForm] = useState<PlaceFormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchOptions = () => {
    fetch("/api/admin/place-categories")
      .then((response) => response.json())
      .then((data) => setOptions(data.options ?? []))
      .catch(() => {});
  };

  const fetchPlaces = (q: string, selectedCategoryId: string) => {
    setLoading(true);
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (selectedCategoryId) params.set("categoryId", selectedCategoryId);
    fetch(`/api/admin/places?${params}`)
      .then((response) => response.json())
      .then((data) => setPlaces(data.places ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchOptions();
    fetchPlaces("", "");
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchPlaces(search, categoryId), 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search, categoryId]);

  const openEdit = (place: AdminPlaceRow) => {
    setEditingPlace(place);
    setError(null);
    setForm({
      categoryId: place.category?.slug ?? "",
      description: place.description ?? "",
      address: place.address ?? "",
      website: place.website ?? "",
    });
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editingPlace) return;

    setSaving(true);
    setError(null);

    const response = await fetch(`/api/admin/places/${editingPlace.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        categoryId: form.categoryId || null,
        description: form.description,
        address: form.address,
        website: form.website,
      }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setError(data.error || "Failed to update place");
      setSaving(false);
      return;
    }

    setSaving(false);
    setEditingPlace(null);
    fetchPlaces(search, categoryId);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Places</h2>
        <p className="mt-1 text-muted-foreground">
          Review place metadata and correct category assignments.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            value={search}
            placeholder="Search places by name..."
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <div className="w-full sm:w-72">
          <PlaceCategorySelect
            value={categoryId}
            onChange={setCategoryId}
            options={options}
            includeDisabled
            emptyLabel="All categories"
          />
        </div>
      </div>

      {loading ? (
        <p className="py-12 text-center text-muted-foreground">Loading places...</p>
      ) : places.length === 0 ? (
        <div className="rounded-lg border py-12 text-center">
          <p className="text-muted-foreground">No places found.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium">Place</th>
                <th className="px-4 py-3 text-left font-medium">Category</th>
                <th className="px-4 py-3 text-right font-medium">Check-ins</th>
                <th className="px-4 py-3 text-left font-medium">Created</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {places.map((place) => (
                <tr key={place.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <div className="font-medium">{place.name}</div>
                    {place.address && (
                      <div className="text-xs text-muted-foreground">{place.address}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {place.category ? `${place.category.emoji} ${place.category.label}` : "Uncategorized"}
                  </td>
                  <td className="px-4 py-3 text-right">{place.checkinCount}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(place.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(place)}>
                      <Pencil className="size-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={editingPlace != null} onOpenChange={(open) => !open && setEditingPlace(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Place</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="place-category">Category</Label>
              <PlaceCategorySelect
                id="place-category"
                value={form.categoryId}
                onChange={(value) => setForm((current) => ({ ...current, categoryId: value }))}
                options={options}
                includeDisabled
                emptyLabel="Uncategorized"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="place-description">Description</Label>
              <Textarea
                id="place-description"
                rows={4}
                value={form.description}
                onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="place-address">Address</Label>
              <Input
                id="place-address"
                value={form.address}
                onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="place-website">Website</Label>
              <Input
                id="place-website"
                value={form.website}
                onChange={(event) => setForm((current) => ({ ...current, website: event.target.value }))}
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditingPlace(null)}>
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
