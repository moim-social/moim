import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { utcToDatetimeLocal, datetimeLocalToUTC } from "~/lib/timezone";
import { useDashboard, type TierItem } from "./route";

export const Route = createFileRoute("/events/$eventId/dashboard/tiers")({
  component: TiersTab,
});

function TiersTab() {
  const { eventId } = Route.useParams();
  const navigate = useNavigate();
  const ctx = useDashboard();

  const [tiers, setTiers] = useState<TierItem[]>(() =>
    ctx ? ctx.data.tiers.map((t) => ({
      ...t,
      opensAt: t.opensAt ? utcToDatetimeLocal(t.opensAt, ctx.data.event.timezone) : "",
      closesAt: t.closesAt ? utcToDatetimeLocal(t.closesAt, ctx.data.event.timezone) : "",
    })) : [],
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const isGroupEvent = !!ctx?.data.event.groupActorId;

  useEffect(() => {
    if (ctx && !isGroupEvent) {
      navigate({ to: "/events/$eventId/dashboard", params: { eventId }, replace: true });
    }
  }, [ctx, isGroupEvent, eventId, navigate]);

  if (!ctx || !isGroupEvent) return null;

  const { data, setData } = ctx;
  const timezone = data.event.timezone;

  function addTier() {
    setTiers([...tiers, { name: "", sortOrder: tiers.length, opensAt: "", closesAt: "", rsvpCount: 0 }]);
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
            sortOrder: idx,
            opensAt: t.opensAt ? datetimeLocalToUTC(t.opensAt, timezone) : null,
            closesAt: t.closesAt ? datetimeLocalToUTC(t.closesAt, timezone) : null,
          })),
        }),
      });
      const result = await res.json();
      if (!res.ok) {
        setError(result.error ?? "Failed to save tiers");
        setSaving(false);
        return;
      }
      const dashRes = await fetch(`/api/events/${eventId}/dashboard`);
      if (dashRes.ok) {
        const dashData = await dashRes.json();
        setData({ ...data, tiers: dashData.tiers });
        setTiers(
          (dashData.tiers ?? []).map((t: any) => ({
            ...t,
            opensAt: t.opensAt ? utcToDatetimeLocal(t.opensAt, timezone) : "",
            closesAt: t.closesAt ? utcToDatetimeLocal(t.closesAt, timezone) : "",
          })),
        );
      }
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
          Manage registration tiers and their open/close windows.
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
          const hasRsvps = t.rsvpCount > 0;
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
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-xs">Registration opens</Label>
                  <Input
                    type="datetime-local"
                    value={t.opensAt}
                    onChange={(e) => updateTier(idx, { opensAt: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Registration closes</Label>
                  <Input
                    type="datetime-local"
                    value={t.closesAt}
                    onChange={(e) => updateTier(idx, { closesAt: e.target.value })}
                  />
                </div>
              </div>
              {hasRsvps && (
                <p className="text-xs text-muted-foreground">
                  {t.rsvpCount} RSVP{t.rsvpCount !== 1 && "s"} — cannot be removed
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
