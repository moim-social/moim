import { useState } from "react";
import { ChevronRightIcon } from "lucide-react";
import { Card, CardHeader, CardTitle, CardAction, CardContent } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "~/components/ui/collapsible";
import { Switch } from "~/components/ui/switch";
import { cn } from "~/lib/utils";

type Organizer = {
  handle: string;
  name: string;
  source: "local" | "fediverse";
};

type MoreOptionsCardProps = {
  organizers: Organizer[];
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  searchResults: { handle: string; displayName: string }[];
  onAddLocalOrganizer: (user: { handle: string; displayName: string }) => void;
  fedHandle: string;
  onFedHandleChange: (handle: string) => void;
  resolving: boolean;
  onResolveFediOrganizer: () => void;
  onRemoveOrganizer: (handle: string) => void;
  allowAnonymousRsvp: boolean;
  onAllowAnonymousRsvpChange: (value: boolean) => void;
  anonymousContactFields: { email?: string; phone?: string } | null;
  onAnonymousContactFieldsChange: (fields: { email?: string; phone?: string } | null) => void;
};

export function MoreOptionsCard({
  organizers,
  searchQuery,
  onSearchQueryChange,
  searchResults,
  onAddLocalOrganizer,
  fedHandle,
  onFedHandleChange,
  resolving,
  onResolveFediOrganizer,
  onRemoveOrganizer,
  allowAnonymousRsvp,
  onAllowAnonymousRsvpChange,
  anonymousContactFields,
  onAnonymousContactFieldsChange,
}: MoreOptionsCardProps) {
  const [open, setOpen] = useState(false);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer select-none">
            <CardTitle>More Options</CardTitle>
            <CardAction>
              <ChevronRightIcon
                className={cn(
                  "size-5 text-muted-foreground transition-transform duration-200",
                  open && "rotate-90",
                )}
              />
            </CardAction>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="space-y-6">
            {/* Anonymous RSVP */}
            <fieldset className="space-y-3">
              <legend className="text-sm font-medium">RSVP Settings</legend>
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="allow-anon-rsvp" className="text-sm">Allow anonymous registration</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Let people register without signing in. Name, email, and phone are collected instead.
                  </p>
                </div>
                <Switch
                  id="allow-anon-rsvp"
                  checked={allowAnonymousRsvp}
                  onCheckedChange={(checked) => {
                    onAllowAnonymousRsvpChange(checked);
                    if (checked && !anonymousContactFields) {
                      onAnonymousContactFieldsChange({ email: "optional", phone: "hidden" });
                    }
                  }}
                />
              </div>
              {allowAnonymousRsvp && (
                <div className="rounded-md border p-3 space-y-3 bg-muted/30">
                  <p className="text-xs text-muted-foreground">
                    Name is always required. Configure which contact fields anonymous attendees must provide.
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Email</Label>
                      <select
                        className="w-full rounded-md border bg-background px-2 py-1.5 text-sm"
                        value={anonymousContactFields?.email ?? "optional"}
                        onChange={(e) =>
                          onAnonymousContactFieldsChange({
                            ...anonymousContactFields,
                            email: e.target.value,
                          })
                        }
                      >
                        <option value="required">Required</option>
                        <option value="optional">Optional</option>
                        <option value="hidden">Hidden</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Phone</Label>
                      <select
                        className="w-full rounded-md border bg-background px-2 py-1.5 text-sm"
                        value={anonymousContactFields?.phone ?? "hidden"}
                        onChange={(e) =>
                          onAnonymousContactFieldsChange({
                            ...anonymousContactFields,
                            phone: e.target.value,
                          })
                        }
                      >
                        <option value="required">Required</option>
                        <option value="optional">Optional</option>
                        <option value="hidden">Hidden</option>
                      </select>
                    </div>
                  </div>
                  <div className="rounded-md border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950 p-3 space-y-1.5">
                    <p className="text-xs font-medium text-amber-800 dark:text-amber-200">Data responsibility notice</p>
                    <ul className="text-xs text-amber-700 dark:text-amber-300 space-y-1 list-disc pl-4">
                      <li>You are responsible for the personal data collected from anonymous attendees.</li>
                      <li>Contact information (name, email, phone) is shared only with event organizers.</li>
                      <li>All anonymous PII is automatically deleted 30 days after the event ends.</li>
                      <li>Export attendee data before deletion if you need it for record-keeping.</li>
                    </ul>
                  </div>
                </div>
              )}
            </fieldset>

            {/* Organizers */}
            <fieldset className="space-y-3">
              <legend className="text-sm font-medium">Organizers</legend>

              <div className="space-y-1.5">
                <Label>Search registered users</Label>
                <Input
                  type="text"
                  placeholder="Search by name or handle..."
                  value={searchQuery}
                  onChange={(e) => onSearchQueryChange(e.target.value)}
                />
                {searchResults.length > 0 && (
                  <ul className="mt-1 border rounded-md max-h-[200px] overflow-auto">
                    {searchResults.map((u) => (
                      <li
                        key={u.handle}
                        onClick={() => onAddLocalOrganizer(u)}
                        className="px-3 py-2 cursor-pointer hover:bg-accent border-b border-border last:border-b-0"
                      >
                        <strong>{u.displayName}</strong>{" "}
                        <span className="text-muted-foreground">@{u.handle}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="space-y-1.5">
                <Label>Add by fediverse handle</Label>
                <div className="flex gap-2">
                  <Input
                    type="text"
                    placeholder="@user@mastodon.social"
                    value={fedHandle}
                    onChange={(e) => onFedHandleChange(e.target.value)}
                    className="flex-1"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        onResolveFediOrganizer();
                      }
                    }}
                  />
                  <Button
                    type="button"
                    onClick={onResolveFediOrganizer}
                    disabled={resolving}
                  >
                    {resolving ? "Verifying..." : "Verify"}
                  </Button>
                </div>
              </div>

              {organizers.length > 0 && (
                <ul className="space-y-1">
                  {organizers.map((o) => (
                    <li
                      key={o.handle}
                      className="flex items-center justify-between px-3 py-2 border rounded-md"
                    >
                      <span className="flex items-center gap-2">
                        <strong>{o.name}</strong>
                        <span className="text-muted-foreground">@{o.handle}</span>
                        {o.source === "fediverse" && (
                          <Badge variant="secondary">fediverse</Badge>
                        )}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => onRemoveOrganizer(o.handle)}
                        className="text-destructive hover:text-destructive"
                      >
                        Remove
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </fieldset>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
