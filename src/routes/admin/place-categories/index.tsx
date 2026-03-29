import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Download, Pencil, Plus, Upload, X } from "lucide-react";
import { EmojiPickerInput } from "~/components/EmojiPickerInput";
import { PlaceCategorySelect } from "~/components/PlaceCategorySelect";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import type { PlaceCategoryOption } from "~/lib/place";
import { SUPPORTED_LOCALES } from "~/shared/place-categories";

export const Route = createFileRoute("/admin/place-categories/")({
  component: AdminPlaceCategoriesPage,
});

type AdminPlaceCategory = {
  slug: string;
  label: string;
  labels: Record<string, string>;
  emoji: string;
  parentSlug: string | null;
  sortOrder: number;
  enabled: boolean;
  children: AdminPlaceCategory[];
};

type CategoryFormState = {
  slug: string;
  label: string;
  translatedLabels: Record<string, string>;
  emoji: string;
  parentSlug: string;
  sortOrder: string;
  enabled: boolean;
};

const emptyForm: CategoryFormState = {
  slug: "",
  label: "",
  translatedLabels: {},
  emoji: "",
  parentSlug: "",
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
  const [importing, setImporting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [editingSlug, setEditingSlug] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importText, setImportText] = useState("");
  const [form, setForm] = useState<CategoryFormState>(emptyForm);
  const [selectedLocale, setSelectedLocale] = useState<string>("");

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
    setEditingSlug(null);
    setError(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const openEdit = (category: AdminPlaceCategory & { depth: number }) => {
    setEditingSlug(category.slug);
    setError(null);
    setForm({
      slug: category.slug,
      label: category.label,
      translatedLabels: { ...category.labels },
      emoji: category.emoji,
      parentSlug: category.parentSlug ?? "",
      sortOrder: String(category.sortOrder),
      enabled: category.enabled,
    });
    setShowForm(true);
  };

  const handleExport = async () => {
    const response = await fetch("/api/admin/place-categories?format=json");
    const data = await response.json();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `place-categories-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const handleImport = async (event: React.FormEvent) => {
    event.preventDefault();
    setImporting(true);
    setImportError(null);

    let parsed: unknown;
    try {
      parsed = JSON.parse(importText);
    } catch {
      setImportError("Import JSON is not valid.");
      setImporting(false);
      return;
    }

    const response = await fetch("/api/admin/place-categories", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setImportError(data.error || "Failed to import categories");
      setImporting(false);
      return;
    }

    setImporting(false);
    setShowImportDialog(false);
    setImportText("");
    fetchCategories();
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);

    const labels: Record<string, string> = {};
    for (const [loc, val] of Object.entries(form.translatedLabels)) {
      const trimmed = val.trim();
      if (trimmed) labels[loc] = trimmed;
    }

    const payload = {
      slug: form.slug.trim(),
      label: form.label.trim(),
      labels,
      emoji: form.emoji.trim(),
      parentSlug: form.parentSlug || null,
      sortOrder: Number(form.sortOrder),
      enabled: form.enabled,
    };

    const response = await fetch(
      editingSlug
        ? `/api/admin/place-categories/${editingSlug}`
        : "/api/admin/place-categories",
      {
        method: editingSlug ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingSlug ? { ...payload, categorySlug: editingSlug } : payload),
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
        <div className="flex items-center gap-2">
          <select
            className="h-9 rounded-md border bg-background px-3 text-sm"
            value={selectedLocale}
            onChange={(e) => setSelectedLocale(e.target.value)}
          >
            <option value="">Default</option>
            {SUPPORTED_LOCALES.map((loc) => (
              <option key={loc} value={loc}>{loc}</option>
            ))}
          </select>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="mr-1 size-4" />
            Export JSON
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setImportError(null);
              setShowImportDialog(true);
            }}
          >
            <Upload className="mr-1 size-4" />
            Import JSON
          </Button>
          <Button onClick={openCreate} size="sm">
            <Plus className="mr-1 size-4" />
            New Category
          </Button>
        </div>
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
                const parent = rows.find((row) => row.slug === category.parentSlug);
                return (
                  <tr key={category.slug} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <div className="font-medium" style={{ paddingLeft: `${category.depth * 20}px` }}>
                        {category.emoji}{" "}
                        {selectedLocale && category.labels?.[selectedLocale]
                          ? category.labels[selectedLocale]
                          : category.label}
                        {selectedLocale && !category.labels?.[selectedLocale] && (
                          <span className="ml-1 text-xs text-muted-foreground">(fallback)</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{category.slug}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {parent ? `${parent.emoji} ${parent.label}` : "Root"}
                    </td>
                    <td className="px-4 py-3 text-center">{category.sortOrder}</td>
                    <td className="px-4 py-3 text-center">{category.enabled ? "Yes" : "No"}</td>
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
            <DialogTitle>{editingSlug ? "Edit Category" : "Create Category"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="category-slug">Slug</Label>
                <Input
                  id="category-slug"
                  value={form.slug}
                  disabled={editingSlug != null}
                  onChange={(event) => setForm((current) => ({ ...current, slug: event.target.value }))}
                />
                {editingSlug && (
                  <p className="text-xs text-muted-foreground">
                    Slug is the stable identifier for this taxonomy.
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="category-label">Label (fallback)</Label>
                <Input
                  id="category-label"
                  value={form.label}
                  onChange={(event) => setForm((current) => ({ ...current, label: event.target.value }))}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Translations</Label>
                <div className="space-y-2">
                  {Object.entries(form.translatedLabels).map(([loc, val]) => (
                    <div key={loc} className="flex items-center gap-2">
                      <span className="w-10 shrink-0 text-center text-xs font-medium text-muted-foreground uppercase">{loc}</span>
                      <Input
                        value={val}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            translatedLabels: {
                              ...current.translatedLabels,
                              [loc]: event.target.value,
                            },
                          }))
                        }
                        placeholder={form.label || "Translated label"}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setForm((current) => {
                            const { [loc]: _, ...rest } = current.translatedLabels;
                            return { ...current, translatedLabels: rest };
                          })
                        }
                      >
                        <X className="size-4" />
                      </Button>
                    </div>
                  ))}
                  {SUPPORTED_LOCALES.filter((loc) => !(loc in form.translatedLabels)).length > 0 && (
                    <div className="flex items-center gap-2">
                      <select
                        className="h-9 w-20 shrink-0 rounded-md border bg-background px-2 text-sm"
                        value=""
                        onChange={(e) => {
                          const loc = e.target.value;
                          if (!loc) return;
                          setForm((current) => ({
                            ...current,
                            translatedLabels: {
                              ...current.translatedLabels,
                              [loc]: "",
                            },
                          }));
                        }}
                      >
                        <option value="">Add...</option>
                        {SUPPORTED_LOCALES.filter((loc) => !(loc in form.translatedLabels)).map((loc) => (
                          <option key={loc} value={loc}>{loc}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
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
                  value={form.parentSlug}
                  onChange={(parentSlug) => setForm((current) => ({ ...current, parentSlug }))}
                  options={options.filter((option) => option.slug !== editingSlug)}
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
                {saving ? "Saving..." : editingSlug ? "Save Changes" : "Create Category"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import Categories</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleImport} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="category-import-file">JSON File</Label>
              <Input
                id="category-import-file"
                type="file"
                accept="application/json"
                onChange={async (event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  setImportText(await file.text());
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="category-import-json">JSON Payload</Label>
              <Textarea
                id="category-import-json"
                rows={14}
                value={importText}
                onChange={(event) => setImportText(event.target.value)}
                placeholder='{"categories":[...]}'
              />
            </div>

            {importError && <p className="text-sm text-destructive">{importError}</p>}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowImportDialog(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={importing || !importText.trim()}>
                {importing ? "Importing..." : "Import Categories"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
