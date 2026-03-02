import { useState, useEffect, useRef } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Checkbox } from "~/components/ui/checkbox";
import { Badge } from "~/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Plus, Pencil, Trash2, Upload } from "lucide-react";

export const Route = createFileRoute("/admin/banners")({
  component: AdminBannersPage,
});

type Banner = {
  id: string;
  title: string;
  imageUrl: string;
  linkUrl: string;
  altText: string | null;
  requester: string | null;
  weight: number;
  enabled: boolean;
  startsAt: string;
  endsAt: string | null;
  impressionCount: number;
  clickCount: number;
  createdAt: string;
  updatedAt: string;
};

type BannerFormData = {
  title: string;
  imageUrl: string;
  linkUrl: string;
  altText: string;
  requester: string;
  weight: number;
  enabled: boolean;
  startsAt: string;
  endsAt: string;
};

const emptyForm: BannerFormData = {
  title: "",
  imageUrl: "",
  linkUrl: "",
  altText: "",
  requester: "",
  weight: 0,
  enabled: false,
  startsAt: "",
  endsAt: "",
};

function toLocalDatetime(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  const offset = d.getTimezoneOffset();
  const local = new Date(d.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function AdminBannersPage() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<BannerFormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchBanners = () => {
    setLoading(true);
    fetch("/admin/banners/list")
      .then((r) => r.json())
      .then((data) => setBanners(data.banners ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchBanners();
  }, []);

  const handleToggle = async (id: string, enabled: boolean) => {
    await fetch("/admin/banners/toggle", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, enabled }),
    });
    fetchBanners();
  };

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const openEdit = (banner: Banner) => {
    setEditingId(banner.id);
    setForm({
      title: banner.title,
      imageUrl: banner.imageUrl,
      linkUrl: banner.linkUrl,
      altText: banner.altText ?? "",
      requester: banner.requester ?? "",
      weight: banner.weight,
      enabled: banner.enabled,
      startsAt: toLocalDatetime(banner.startsAt),
      endsAt: banner.endsAt ? toLocalDatetime(banner.endsAt) : "",
    });
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    const payload = {
      ...(editingId ? { id: editingId } : {}),
      title: form.title,
      imageUrl: form.imageUrl,
      linkUrl: form.linkUrl,
      altText: form.altText || null,
      requester: form.requester || null,
      weight: form.weight,
      enabled: form.enabled,
      startsAt: new Date(form.startsAt).toISOString(),
      endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : null,
    };

    await fetch(editingId ? "/admin/banners/update" : "/admin/banners/create", {
      method: editingId ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setSaving(false);
    setShowForm(false);
    fetchBanners();
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await fetch(`/admin/banners/delete?id=${deleteId}`, { method: "DELETE" });
    setDeleteId(null);
    fetchBanners();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Banners</h2>
          <p className="mt-1 text-muted-foreground">
            Manage commercial banners displayed on the homepage carousel.
          </p>
        </div>
        <Button onClick={openCreate} size="sm">
          <Plus className="size-4 mr-1" />
          New Banner
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <p className="text-muted-foreground">Loading banners...</p>
        </div>
      ) : banners.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <p className="text-muted-foreground mb-4">
            No banners yet. Create your first commercial banner.
          </p>
          <Button onClick={openCreate} size="sm">
            <Plus className="size-4 mr-1" />
            New Banner
          </Button>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium">Title</th>
                <th className="px-4 py-3 text-left font-medium">Requester</th>
                <th className="px-4 py-3 text-center font-medium">Weight</th>
                <th className="px-4 py-3 text-center font-medium">Enabled</th>
                <th className="px-4 py-3 text-left font-medium">Schedule</th>
                <th className="px-4 py-3 text-right font-medium">Impressions</th>
                <th className="px-4 py-3 text-right font-medium">Clicks</th>
                <th className="px-4 py-3 text-right font-medium">CTR</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {banners.map((banner) => {
                const ctr =
                  banner.impressionCount > 0
                    ? ((banner.clickCount / banner.impressionCount) * 100).toFixed(1)
                    : "0.0";
                return (
                  <tr key={banner.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {banner.imageUrl && (
                          <img
                            src={banner.imageUrl}
                            alt=""
                            className="h-8 w-12 rounded object-cover border"
                          />
                        )}
                        <span className="font-medium truncate max-w-[200px]">{banner.title}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {banner.requester || "—"}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge variant="secondary">{banner.weight}</Badge>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Checkbox
                        checked={banner.enabled}
                        onCheckedChange={(checked) =>
                          handleToggle(banner.id, checked === true)
                        }
                      />
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      <div>{formatDate(banner.startsAt)}</div>
                      {banner.endsAt ? (
                        <div>→ {formatDate(banner.endsAt)}</div>
                      ) : (
                        <div className="text-muted-foreground/60">indefinite</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {banner.impressionCount.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {banner.clickCount.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                      {ctr}%
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEdit(banner)}
                          className="size-8 p-0"
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteId(banner.id)}
                          className="size-8 p-0 text-destructive hover:text-destructive"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Edit Banner" : "Create Banner"}
            </DialogTitle>
            <DialogDescription>
              {editingId
                ? "Update the banner details below."
                : "Fill in the details for a new commercial banner."}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                required
                placeholder="Banner title"
              />
            </div>

            <div className="grid gap-2">
              <Label>Banner Image *</Label>
              <p className="text-xs text-muted-foreground">
                Recommended: 2048×680px (3:1 ratio). Landscape only. Images will be resized and converted to WebP on upload.
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={uploading}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="size-4 mr-1" />
                  {uploading ? "Uploading..." : "Upload Image"}
                </Button>
                <span className="text-xs text-muted-foreground self-center">or enter URL below</span>
              </div>
              {uploadError && (
                <p className="text-xs text-destructive">{uploadError}</p>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setUploading(true);
                  setUploadError(null);
                  try {
                    const formData = new FormData();
                    formData.append("file", file);
                    const res = await fetch("/admin/banner-upload", {
                      method: "POST",
                      body: formData,
                    });
                    const data = await res.json();
                    if (res.ok && data.imageUrl) {
                      setForm((prev) => ({ ...prev, imageUrl: data.imageUrl }));
                    } else {
                      setUploadError(data.error ?? "Upload failed");
                    }
                  } catch {
                    setUploadError("Upload failed");
                  } finally {
                    setUploading(false);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }
                }}
              />
              <Input
                id="imageUrl"
                value={form.imageUrl}
                onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
                required
                placeholder="https://example.com/banner.jpg"
              />
              {form.imageUrl && (
                <div className="mt-1 rounded-md overflow-hidden border aspect-[3/1] max-h-40">
                  <img
                    src={form.imageUrl}
                    alt="Preview"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                </div>
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="linkUrl">Link URL *</Label>
              <Input
                id="linkUrl"
                value={form.linkUrl}
                onChange={(e) => setForm({ ...form, linkUrl: e.target.value })}
                required
                placeholder="https://example.com"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="altText">Alt Text</Label>
              <Input
                id="altText"
                value={form.altText}
                onChange={(e) => setForm({ ...form, altText: e.target.value })}
                placeholder="Descriptive text for accessibility"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="requester">Requester</Label>
                <Input
                  id="requester"
                  value={form.requester}
                  onChange={(e) =>
                    setForm({ ...form, requester: e.target.value })
                  }
                  placeholder="Company name"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="weight">Weight</Label>
                <Input
                  id="weight"
                  type="number"
                  value={form.weight}
                  onChange={(e) =>
                    setForm({ ...form, weight: parseInt(e.target.value) || 0 })
                  }
                  min={0}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="startsAt">Starts At *</Label>
                <Input
                  id="startsAt"
                  type="datetime-local"
                  value={form.startsAt}
                  onChange={(e) =>
                    setForm({ ...form, startsAt: e.target.value })
                  }
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="endsAt">Ends At</Label>
                <Input
                  id="endsAt"
                  type="datetime-local"
                  value={form.endsAt}
                  onChange={(e) => setForm({ ...form, endsAt: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  Leave empty for indefinite
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="enabled"
                checked={form.enabled}
                onCheckedChange={(checked) =>
                  setForm({ ...form, enabled: checked === true })
                }
              />
              <Label htmlFor="enabled" className="cursor-pointer">
                Enabled
              </Label>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowForm(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving
                  ? "Saving..."
                  : editingId
                    ? "Update Banner"
                    : "Create Banner"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Banner</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this banner? This action cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
