import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { Button } from "~/components/ui/button";
import { Label } from "~/components/ui/label";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Card, CardContent } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Separator } from "~/components/ui/separator";
import { LinkAccountDialog } from "~/components/LinkAccountDialog";
import { LANGUAGES } from "~/shared/languages";

export const Route = createFileRoute("/settings/")({
  component: SettingsPage,
});

function SettingsPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [language, setLanguage] = useState("");
  const [linkedAccounts, setLinkedAccounts] = useState<
    Array<{ id: string; fediverseHandle: string; isPrimary: boolean; createdAt: string }>
  >([]);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [accountError, setAccountError] = useState("");

  const fetchLinkedAccounts = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/linked-accounts");
      if (res.ok) {
        const data = await res.json();
        setLinkedAccounts(data.accounts);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    fetch("/api/users/settings")
      .then((r) => {
        if (r.status === 401) {
          navigate({ to: "/auth/signin" });
          return null;
        }
        if (!r.ok) throw new Error("Failed to load settings");
        return r.json();
      })
      .then((data) => {
        if (!data) return;
        setLanguage(data.language ?? "");
        setLoading(false);
      })
      .catch(() => {
        setError("Failed to load settings");
        setLoading(false);
      });

    fetchLinkedAccounts();
  }, [navigate, fetchLinkedAccounts]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    setSuccess(false);

    try {
      const res = await fetch("/api/users/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language: language || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to save settings");
        setSubmitting(false);
        return;
      }
      setSuccess(true);
      setSubmitting(false);
    } catch {
      setError("Network error");
      setSubmitting(false);
    }
  }

  if (loading) {
    return <p className="text-muted-foreground">Loading...</p>;
  }

  return (
    <main className="mx-auto max-w-2xl space-y-6">
      <h2 className="text-2xl font-semibold tracking-tight">Settings</h2>

      <Card className="rounded-lg">
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold">Federation</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Configure how your posts appear on the fediverse.
              </p>
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {success && (
              <Alert className="border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-200">
                <AlertDescription>Settings saved.</AlertDescription>
              </Alert>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="language">Post Language</Label>
              <select
                id="language"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="">Auto (instance default)</option>
                {LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code}>{l.label}</option>
                ))}
              </select>
              <p className="text-sm text-muted-foreground">
                Language tag attached to your federated posts (check-ins, etc.).
              </p>
            </div>

            <div className="flex justify-end">
              <Button type="submit" disabled={submitting}>
                {submitting ? "Saving..." : "Save"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Separator />

      <Card className="rounded-lg">
        <CardContent className="pt-6 space-y-4">
          <div>
            <h3 className="text-lg font-semibold">Linked Accounts</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Fediverse accounts linked to your Moim identity.
            </p>
          </div>

          {accountError && (
            <Alert variant="destructive">
              <AlertDescription>{accountError}</AlertDescription>
            </Alert>
          )}

          {linkedAccounts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No linked accounts found.</p>
          ) : (
            <div className="space-y-2">
              {linkedAccounts.map((account) => (
                <div
                  key={account.id}
                  className="flex items-center justify-between rounded-md border px-4 py-3"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">
                      @{account.fediverseHandle}
                    </span>
                    {account.isPrimary && (
                      <Badge variant="secondary">Primary</Badge>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {!account.isPrimary && (
                      <>
                        <Button
                          variant="outline"
                          size="xs"
                          onClick={() => setPrimary(account.fediverseHandle)}
                        >
                          Set Primary
                        </Button>
                        <Button
                          variant="ghost"
                          size="xs"
                          onClick={() => unlinkAccount(account.fediverseHandle)}
                          disabled={linkedAccounts.length <= 1}
                        >
                          Unlink
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          <Button variant="outline" onClick={() => setLinkDialogOpen(true)}>
            Link New Account
          </Button>
        </CardContent>
      </Card>

      <LinkAccountDialog
        open={linkDialogOpen}
        onOpenChange={setLinkDialogOpen}
        onLinked={fetchLinkedAccounts}
      />
    </main>
  );

  async function setPrimary(fediverseHandle: string) {
    setAccountError("");
    try {
      const res = await fetch("/api/auth/primary-account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fediverseHandle }),
      });
      if (!res.ok) {
        const data = await res.json();
        setAccountError(data.error ?? "Failed to set primary");
        return;
      }
      await fetchLinkedAccounts();
    } catch {
      setAccountError("Network error");
    }
  }

  async function unlinkAccount(fediverseHandle: string) {
    setAccountError("");
    try {
      const res = await fetch("/api/auth/linked-accounts", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fediverseHandle }),
      });
      if (!res.ok) {
        const data = await res.json();
        setAccountError(data.error ?? "Failed to unlink");
        return;
      }
      await fetchLinkedAccounts();
    } catch {
      setAccountError("Network error");
    }
  }
}
