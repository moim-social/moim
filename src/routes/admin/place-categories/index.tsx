import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Plus, Pencil } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Checkbox } from "~/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { EmojiPickerInput } from "~/components/EmojiPickerInput";
import { PlaceCategorySelect } from "~/components/PlaceCategorySelect";
import type { PlaceCategoryOption } from "~/lib/place";

export const Route = createFileRoute("/admin/place-categories/")({
  component: AdminPlaceCategoriesPage,
});

type AdminPlaceCategory = {
  id: string;
  slug: string;
  label: string;
  emoji: string;
  parentId: string | null;
  sortOrder: number;
  enabled: boolean;
  children: AdminPlaceCategory[];
};

type CategoryFormState = {
  id: string;
  slug: string;
  label: string;
  emoji: string;
  parentId: string;
  sortOrder: string;
  enabled: boolean;
};

const emptyForm: CategoryFormState = {
  id: "",
  slug: "",
  label: "",
  emoji: "",
  parentId: "",
  sortOrder: "0",
  enabled: true,
};

function flattenCategories(nodes: AdminPlaceCategory[], depth = 0): Array<AdminPlaceCategory & { depth: number }> {
  return nodes.flatMap((node) => [
    { ...node, depth },
    ...flattenCategories(node.children, depth + 1),
  ]);
}

function AdminPlaceCategoriesPage() {
  const [categories, setCategories] = useState<AdminPlaceCategory[]>([]);
  const [options, setOptions] = useState<PlaceCategoryOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<CategoryFormState>(emptyForm);

  const rows = useMemo(() => flattenCategories(categories), [categories]);

  const fetchCategories = () => {
    setLoading(true);
    fetch("/api/admin/place-categories")
      .then((response) => response.json())
      .then((data) => {
        setCategories(data.categories ?? []);
        setOptions(data.options ?? []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const openCreate = () => {
    setEditingId(null);
    setError(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const openEdit = (category: AdminPlaceCategory & { depth: number }) => {
    setEditingId(category.id);
    setError(null);
    setForm({
      id: category.id,
      slug: category.slug,
      label: category.label,
      emoji: category.emoji,
      parentId: category.parentId ?? "",
      sortOrder: String(category.sortOrder),
      enabled: category.enabled,
    });
    setShowForm(true);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);

    const payload = {
      id: form.id.trim(),
      slug: form.slug.trim(),
      label: form.label.trim(),
      emoji: form.emoji.trim(),
      parentId: form.parentId || null,
      sortOrder: Number(form.sortOrder),
      enabled: form.enabled,
    };

    const response = await fetch(
      editingId
        ? `/api/admin/place-categories/${editingId}`
        : "/api/admin/place-categories",
      {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setError(data.error || "Failed to save category");
      setSaving(false);
      return;
    }

    setSaving(false);
    setShowForm(false);
    fetchCategories();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Place Categories</h2>
          <p className="mt-1 text-muted-foreground">
            Manage the hierarchical taxonomy used for places and check-ins.
          </p>
        </div>
        <Button onClick={openCreate} size="sm">
          <Plus className="mr-1 size-4" />
          New Category
        </Button>
      </div>

      {loading ? (
        <p className="py-12 text-center text-muted-foreground">Loading categories...</p>
      ) : rows.length === 0 ? (
        <div className="rounded-lg border py-12 text-center">
          <p className="text-muted-foreground">No place categories found.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium">Category</th>
                <th className="px-4 py-3 text-left font-medium">Slug</th>
                <th className="px-4 py-3 text-left font-medium">Parent</th>
                <th className="px-4 py-3 text-center font-medium">Sort</th>
                <th className="px-4 py-3 text-center font-medium">Enabled</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((category) => {
                const parent = rows.find((row) => row.id === category.parentId);
                return (
                  <tr key={category.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <div
                        className="font-medium"
                        style={{ paddingLeft: `${category.depth * 20}px` }}
                      >
                        {category.emoji} {category.label}
                      </div>
                      <div className="text-xs text-muted-foreground">{category.id}</div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{category.slug}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {parent ? `${parent.emoji} ${parent.label}` : "Root"}
                    </td>
                    <td className="px-4 py-3 text-center">{category.sortOrder}</td>
                    <td className="px-4 py-3 text-center">
                      {category.enabled ? "Yes" : "No"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(category)}>
                        <Pencil className="size-4" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Category" : "Create Category"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="category-id">ID</Label>
                <Input
                  id="category-id"
                  value={form.id}
                  disabled={editingId != null}
                  onChange={(event) => setForm((current) => ({ ...current, id: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category-slug">Slug</Label>
                <Input
                  id="category-slug"
                  value={form.slug}
                  onChange={(event) => setForm((current) => ({ ...current, slug: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category-label">Label</Label>
                <Input
                  id="category-label"
                  value={form.label}
                  onChange={(event) => setForm((current) => ({ ...current, label: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category-emoji">Emoji</Label>
                <EmojiPickerInput
                  id="category-emoji"
                  value={form.emoji}
                  onChange={(emoji) => setForm((current) => ({ ...current, emoji }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category-parent">Parent</Label>
                <PlaceCategorySelect
                  id="category-parent"
                  value={form.parentId}
                  onChange={(parentId) => setForm((current) => ({ ...current, parentId }))}
                  options={options.filter((option) => option.id !== editingId)}
                  includeDisabled
                  emptyLabel="Root category"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category-sort-order">Sort Order</Label>
                <Input
                  id="category-sort-order"
                  type="number"
                  value={form.sortOrder}
                  onChange={(event) => setForm((current) => ({ ...current, sortOrder: event.target.value }))}
                />
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={form.enabled}
                onCheckedChange={(checked) => setForm((current) => ({ ...current, enabled: checked === true }))}
              />
              Enabled for public use
            </label>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving..." : editingId ? "Save Changes" : "Create Category"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
