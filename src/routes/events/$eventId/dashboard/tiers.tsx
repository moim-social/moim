import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Button } from "~/components/ui/button";
import { DateTimePicker } from "~/components/DateTimePicker";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { utcToDatetimeLocal, datetimeLocalToUTC } from "~/lib/timezone";
import { useDashboard, type TierItem } from "./route";

export const Route = createFileRoute("/events/$eventId/dashboard/tiers")({
  component: TiersTab,
});

function TiersTab() {
  const { eventId } = Route.useParams();
  const navigate = useNavigate();
  const { data, refresh } = useDashboard();

  const isGroupEvent = !!data.event.groupActorId;
  const timezone = data.event.timezone;

  const [tiers, setTiers] = useState<TierItem[]>(() =>
    data.tiers.map((t) => ({
      ...t,
      opensAt: t.opensAt ? utcToDatetimeLocal(t.opensAt, timezone) : "",
      closesAt: t.closesAt ? utcToDatetimeLocal(t.closesAt, timezone) : "",
    })),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!isGroupEvent) {
      navigate({ to: "/events/$eventId/dashboard", params: { eventId }, replace: true });
    }
  }, [isGroupEvent, eventId, navigate]);

  if (!isGroupEvent) return null;

  function addTier() {
    setTiers([...tiers, { name: "", description: null, price: null, sortOrder: tiers.length, opensAt: "", closesAt: "", capacity: null, acceptedCount: 0, waitlistedCount: 0 }]);
    setSuccess(false);
  }

  function removeTier(idx: number) {
    setTiers(tiers.filter((_, i) => i !== idx));
    setSuccess(false);
  }

  function updateTier(idx: number, patch: Partial<TierItem>) {
    const updated = [...tiers];
    updated[idx] = { ...updated[idx], ...patch };
    setTiers(updated);
    setSuccess(false);
  }

  async function handleSave() {
    setSaving(true);
    setError("");
    setSuccess(false);
    try {
      const res = await fetch(`/api/events/${eventId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: data.event.title,
          startsAt: data.event.startsAt,
          categoryId: data.event.categoryId,
          tiers: tiers.map((t, idx) => ({
            id: t.id,
            name: t.name.trim(),
            description: t.description?.trim() || null,
            price: t.price?.trim() || null,
            sortOrder: idx,
            opensAt: t.opensAt ? datetimeLocalToUTC(t.opensAt, timezone) : null,
            closesAt: t.closesAt ? datetimeLocalToUTC(t.closesAt, timezone) : null,
            capacity: t.capacity || null,
          })),
        }),
      });
      const result = await res.json();
      if (!res.ok) {
        setError(result.error ?? "Failed to save tiers");
        setSaving(false);
        return;
      }
      refresh();
      setSuccess(true);
    } catch {
      setError("Network error");
    }
    setSaving(false);
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Ticket Types</h2>
        <p className="mt-1 text-muted-foreground">
          Manage registration tiers, capacity limits, and open/close windows.
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert>
          <AlertDescription>Tiers saved successfully.</AlertDescription>
        </Alert>
      )}

      <div className="space-y-3">
        {tiers.map((t, idx) => {
          const totalRsvps = t.acceptedCount + t.waitlistedCount;
          const hasRsvps = totalRsvps > 0;
          const isOnlyTier = tiers.length <= 1;
          return (
            <div key={t.id ?? `new-tier-${idx}`} className="border rounded-md p-3 space-y-2">
              <div className="flex items-start gap-3">
                <div className="flex-1">
                  <Input
                    placeholder={`Tier ${idx + 1} name`}
                    value={t.name}
                    onChange={(e) => updateTier(idx, { name: e.target.value })}
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  disabled={hasRsvps || isOnlyTier}
                  onClick={() => removeTier(idx)}
                >
                  Remove
                </Button>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Description</Label>
                <Textarea
                  placeholder="Describe this tier..."
                  value={t.description ?? ""}
                  rows={2}
                  onChange={(e) => updateTier(idx, { description: e.target.value || null })}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div className="space-y-1">
                  <Label className="text-xs">Price</Label>
                  <Input
                    placeholder="Free"
                    value={t.price ?? ""}
                    onChange={(e) => updateTier(idx, { price: e.target.value || null })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Max attendees</Label>
                  <Input
                    type="number"
                    min="0"
                    placeholder="Unlimited"
                    value={t.capacity ?? ""}
                    onChange={(e) => {
                      const val = e.target.value === "" ? null : parseInt(e.target.value, 10);
                      updateTier(idx, { capacity: val });
                    }}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Registration opens</Label>
                  <DateTimePicker
                    value={t.opensAt}
                    onChange={(v) => updateTier(idx, { opensAt: v })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Registration closes</Label>
                  <DateTimePicker
                    value={t.closesAt}
                    onChange={(v) => updateTier(idx, { closesAt: v })}
                  />
                </div>
              </div>
              {hasRsvps && (
                <p className="text-xs text-muted-foreground">
                  {t.acceptedCount} attending{t.capacity != null ? ` / ${t.capacity}` : ""}
                  {t.waitlistedCount > 0 && ` · ${t.waitlistedCount} waitlisted`}
                  {" "}— cannot be removed
                </p>
              )}
              {t.capacity != null && t.capacity > 0 && t.acceptedCount > t.capacity && (
                <p className="text-xs text-destructive">
                  Warning: current attendees ({t.acceptedCount}) exceed capacity ({t.capacity})
                </p>
              )}
              {isOnlyTier && !hasRsvps && (
                <p className="text-xs text-muted-foreground">
                  At least one tier is required
                </p>
              )}
            </div>
          );
        })}

        <Button type="button" variant="outline" onClick={addTier}>
          + Add Tier
        </Button>
      </div>

      <Button onClick={handleSave} disabled={saving}>
        {saving ? "Saving..." : "Save Changes"}
      </Button>
    </div>
  );
}
