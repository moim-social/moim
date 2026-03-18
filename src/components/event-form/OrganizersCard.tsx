import { useState } from "react";
import { ChevronRightIcon } from "lucide-react";
import { Card, CardHeader, CardTitle, CardAction, CardContent } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "~/components/ui/collapsible";
import { cn } from "~/lib/utils";

type Organizer = {
  handle: string;
  name: string;
  source: "local" | "fediverse" | "external";
  homepageUrl?: string;
  imageUrl?: string;
};

type OrganizersCardProps = {
  organizers: Organizer[];
  fedHandle: string;
  onFedHandleChange: (handle: string) => void;
  resolving: boolean;
  onResolveFediOrganizer: () => void;
  extName: string;
  onExtNameChange: (name: string) => void;
  extUrl: string;
  onExtUrlChange: (url: string) => void;
  onAddExternalOrganizer: () => void;
  onRemoveOrganizer: (handle: string) => void;
};

export function OrganizersCard({
  organizers,
  fedHandle,
  onFedHandleChange,
  resolving,
  onResolveFediOrganizer,
  extName,
  onExtNameChange,
  extUrl,
  onExtUrlChange,
  onAddExternalOrganizer,
  onRemoveOrganizer,
}: OrganizersCardProps) {
  const [open, setOpen] = useState(false);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer select-none">
            <div>
              <CardTitle>
                Co-Organizers
                {organizers.length > 0 && (
                  <span className="ml-1.5 text-xs text-muted-foreground font-normal">
                    ({organizers.length})
                  </span>
                )}
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-2">
                Add organizers or external partners. Organizers are Moim or fediverse users. External organizers are companies, communities, or anyone outside the fediverse.
              </p>
            </div>
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
            {organizers.length > 0 && (
              <ul className="space-y-1">
                {organizers.map((o) => (
                  <li
                    key={o.handle}
                    className="flex items-center justify-between px-3 py-2 border rounded-md"
                  >
                    <span className="flex items-center gap-2">
                      {o.imageUrl ? (
                        <img src={o.imageUrl} alt="" className="size-6 rounded-full object-cover shrink-0" />
                      ) : (
                        <div className="size-6 rounded-full bg-muted text-muted-foreground flex items-center justify-center text-xs font-semibold shrink-0">
                          {o.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <strong>{o.name}</strong>
                      {o.source === "external" ? (
                        <>
                          {o.homepageUrl && (
                            <span className="text-muted-foreground text-xs truncate max-w-[200px]">{o.homepageUrl}</span>
                          )}
                          <Badge variant="outline">external</Badge>
                        </>
                      ) : (
                        <>
                          <span className="text-muted-foreground">@{o.handle}</span>
                          {o.source === "fediverse" && (
                            <Badge variant="secondary">fediverse</Badge>
                          )}
                        </>
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

            <div>
              <Label>External organizer</Label>
              <p className="text-xs text-muted-foreground mt-2">
                For companies, communities, or anyone without a Moim or fediverse account.
              </p>
              <div className="flex gap-2 mt-3">
                <Input
                  type="text"
                  placeholder="Name (e.g. Ubuntu Korea Community)"
                  value={extName}
                  onChange={(e) => onExtNameChange(e.target.value)}
                  className="flex-1"
                />
                <Input
                  type="url"
                  placeholder="Homepage URL (optional)"
                  value={extUrl}
                  onChange={(e) => onExtUrlChange(e.target.value)}
                  className="flex-1"
                />
                <Button
                  type="button"
                  onClick={onAddExternalOrganizer}
                  disabled={!extName.trim()}
                >
                  Add
                </Button>
              </div>
            </div>

            <div>
              <Label>Fediverse user</Label>
              <p className="text-xs text-muted-foreground mt-2">
                Add someone from Mastodon, Misskey, or other fediverse platforms.
              </p>
              <div className="flex gap-2 mt-3">
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
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
