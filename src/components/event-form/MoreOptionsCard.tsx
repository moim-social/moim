import { useState } from "react";
import { ChevronRightIcon } from "lucide-react";
import { Card, CardHeader, CardTitle, CardAction, CardContent } from "~/components/ui/card";
import { Label } from "~/components/ui/label";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "~/components/ui/collapsible";
import { Switch } from "~/components/ui/switch";
import { cn } from "~/lib/utils";

type MoreOptionsCardProps = {
  allowAnonymousRsvp: boolean;
  onAllowAnonymousRsvpChange: (value: boolean) => void;
  anonymousContactFields: { email?: string; phone?: string } | null;
  onAnonymousContactFieldsChange: (fields: { email?: string; phone?: string } | null) => void;
};

export function MoreOptionsCard({
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
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
