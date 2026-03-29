import { useEffect, useRef, useState } from "react";
import { resolveCategoryLabel } from "~/lib/place";
import { createFileRoute } from "@tanstack/react-router";
import { Search, Plus, X } from "lucide-react";
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
import type { PlaceCategorySummary } from "~/lib/place";

export const Route = createFileRoute("/admin/group-places")({
  component: AdminGroupPlacesPage,
});

type GroupSummary = {
  id: string;
  handle: string;
  name: string | null;
};

type AssignedPlace = {
  id: string;
  name: string;
  address: string | null;
  assignedAt: string;
  category: PlaceCategorySummary | null;
};

type SearchPlace = {
  id: string;
  name: string;
  address: string | null;
  category: PlaceCategorySummary | null;
};

function AdminGroupPlacesPage() {
  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [assignedPlaces, setAssignedPlaces] = useState<AssignedPlace[]>([]);
  const [loading, setLoading] = useState(true);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [placeSearch, setPlaceSearch] = useState("");
  const [searchResults, setSearchResults] = useState<SearchPlace[]>([]);
  const [assigning, setAssigning] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch all groups for the dropdown
  useEffect(() => {
    fetch("/api/admin/group-places")
      .then((r) => r.json())
      .then((data) => {
        setGroups(data.groups ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));

  }, []);

  const fetchAssignedPlaces = (groupId: string) => {
    if (!groupId) {
      setAssignedPlaces([]);
      return;
    }
    setLoading(true);
    fetch(`/api/admin/group-places?groupActorId=${groupId}`)
      .then((r) => r.json())
      .then((data) => setAssignedPlaces(data.places ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchAssignedPlaces(selectedGroupId);
  }, [selectedGroupId]);

  // Search places for assign dialog
  useEffect(() => {
    if (!assignDialogOpen) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (placeSearch.length < 2) {
      setSearchResults([]);
      return;
    }
    debounceRef.current = setTimeout(() => {
      fetch(`/api/places?q=${encodeURIComponent(placeSearch)}&limit=10`)
        .then((r) => r.json())
        .then((data) => setSearchResults(data.places ?? []))
        .catch(() => {});
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [placeSearch, assignDialogOpen]);

  const handleAssign = async (placeId: string) => {
    if (!selectedGroupId) return;
    setAssigning(true);
    const res = await fetch("/api/admin/group-places", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ groupActorId: selectedGroupId, placeId }),
    });
    if (res.ok) {
      setAssignDialogOpen(false);
      setPlaceSearch("");
      setSearchResults([]);
      fetchAssignedPlaces(selectedGroupId);
      // Refresh groups list
      fetch("/api/admin/group-places")
        .then((r) => r.json())
        .then((data) => setGroups(data.groups ?? []))
        .catch(() => {});
    } else {
      const data = await res.json().catch(() => ({}));
      alert(data.error || "Failed to assign place");
    }
    setAssigning(false);
  };

  const handleUnassign = async (placeId: string) => {
    if (!selectedGroupId) return;
    if (!confirm("Remove this place from the group?")) return;
    const res = await fetch("/api/admin/group-places", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ groupActorId: selectedGroupId, placeId }),
    });
    if (res.ok) {
      fetchAssignedPlaces(selectedGroupId);
    } else {
      const data = await res.json().catch(() => ({}));
      alert(data.error || "Failed to unassign place");
    }
  };

  const assignedPlaceIds = new Set(assignedPlaces.map((p) => p.id));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Group Places</h2>
        <p className="mt-1 text-muted-foreground">
          Assign places to groups so group members can edit their details.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="w-full sm:w-72">
          <Label htmlFor="group-select">Group</Label>
          <select
            id="group-select"
            className="mt-1.5 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={selectedGroupId}
            onChange={(e) => setSelectedGroupId(e.target.value)}
          >
            <option value="">Select a group...</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name || g.handle} (@{g.handle})
              </option>
            ))}
          </select>
        </div>

        {selectedGroupId && (
          <Button size="sm" onClick={() => { setAssignDialogOpen(true); setPlaceSearch(""); setSearchResults([]); }}>
            <Plus className="size-4 mr-1.5" />
            Assign Place
          </Button>
        )}
      </div>

      {!selectedGroupId ? (
        <div className="rounded-lg border py-12 text-center">
          <p className="text-muted-foreground">Select a group to manage its places.</p>
        </div>
      ) : loading ? (
        <p className="py-12 text-center text-muted-foreground">Loading...</p>
      ) : assignedPlaces.length === 0 ? (
        <div className="rounded-lg border py-12 text-center">
          <p className="text-muted-foreground">No places assigned to this group yet.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium">Place</th>
                <th className="px-4 py-3 text-left font-medium">Category</th>
                <th className="px-4 py-3 text-left font-medium">Assigned</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {assignedPlaces.map((place) => (
                <tr key={place.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <div className="font-medium">{place.name}</div>
                    {place.address && (
                      <div className="text-xs text-muted-foreground">{place.address}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {place.category
                      ? `${place.category.emoji ?? ""} ${place.category.label ? resolveCategoryLabel(place.category as { label: string; labels?: Record<string, string> }) : ""}`.trim()
                      : "Uncategorized"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(place.assignedAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="ghost" size="sm" onClick={() => handleUnassign(place.id)}>
                      <X className="size-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={assignDialogOpen} onOpenChange={(open) => !open && setAssignDialogOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Place to Group</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Search places by name..."
                value={placeSearch}
                onChange={(e) => setPlaceSearch(e.target.value)}
                autoFocus
              />
            </div>
            {placeSearch.length < 2 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                Type at least 2 characters to search.
              </p>
            ) : searchResults.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">No places found.</p>
            ) : (
              <div className="max-h-64 space-y-1 overflow-y-auto">
                {searchResults.map((place) => {
                  const alreadyAssigned = assignedPlaceIds.has(place.id);
                  return (
                    <div
                      key={place.id}
                      className="flex items-center justify-between rounded-md p-2 hover:bg-accent/50"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium">{place.name}</div>
                        {place.address && (
                          <div className="text-xs text-muted-foreground truncate">{place.address}</div>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant={alreadyAssigned ? "secondary" : "default"}
                        disabled={alreadyAssigned || assigning}
                        onClick={() => handleAssign(place.id)}
                      >
                        {alreadyAssigned ? "Assigned" : "Assign"}
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
