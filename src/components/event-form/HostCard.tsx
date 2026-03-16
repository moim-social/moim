import { UserIcon, UsersIcon } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "~/components/ui/card";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "~/components/ui/select";
import { cn } from "~/lib/utils";

type Group = {
  id: string;
  handle: string;
  name: string | null;
  timezone: string | null;
};

type HostCardProps = {
  groups: Group[];
  groupsLoaded: boolean;
  groupActorId: string;
  onGroupChange: (groupId: string) => void;
  onTimezoneInherit: (tz: string) => void;
};

export function HostCard({
  groups,
  groupsLoaded,
  groupActorId,
  onGroupChange,
  onTimezoneInherit,
}: HostCardProps) {
  const isPersonal = !groupActorId;

  function selectPersonal() {
    onGroupChange("");
    onTimezoneInherit(Intl.DateTimeFormat().resolvedOptions().timeZone);
  }

  function selectGroup() {
    if (groups.length > 0 && !groupActorId) {
      onGroupChange(groups[0].id);
      if (groups[0].timezone) onTimezoneInherit(groups[0].timezone);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Host</CardTitle>
        <CardDescription>Choose who will host this event.</CardDescription>
      </CardHeader>
      <CardContent>
        {!groupsLoaded ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              {/* Personal option */}
              <button
                type="button"
                onClick={selectPersonal}
                className={cn(
                  "flex flex-col items-center gap-2 rounded-lg border-2 p-4 text-center transition-colors",
                  isPersonal
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-muted-foreground/50",
                )}
              >
                <div
                  className={cn(
                    "flex size-10 items-center justify-center rounded-full",
                    isPersonal
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  <UserIcon className="size-5" />
                </div>
                <div>
                  <p className={cn("text-sm font-medium", isPersonal && "text-primary")}>
                    Personal
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">Your account</p>
                </div>
              </button>

              {/* Group option */}
              <button
                type="button"
                onClick={selectGroup}
                disabled={groups.length === 0}
                className={cn(
                  "flex flex-col items-center gap-2 rounded-lg border-2 p-4 text-center transition-colors",
                  !isPersonal
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-muted-foreground/50",
                  groups.length === 0 && "opacity-50 cursor-not-allowed",
                )}
              >
                <div
                  className={cn(
                    "flex size-10 items-center justify-center rounded-full",
                    !isPersonal
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  <UsersIcon className="size-5" />
                </div>
                <div>
                  <p className={cn("text-sm font-medium", !isPersonal && "text-primary")}>
                    Group
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {groups.length === 0 ? "No groups" : `${groups.length} available`}
                  </p>
                </div>
              </button>
            </div>

            {/* Group selector */}
            {!isPersonal && groups.length > 0 && (
              <Select
                value={groupActorId}
                onValueChange={(val) => {
                  onGroupChange(val);
                  const selected = groups.find((g) => g.id === val);
                  if (selected?.timezone) onTimezoneInherit(selected.timezone);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a group" />
                </SelectTrigger>
                <SelectContent>
                  {groups.map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      {g.name ?? g.handle}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
