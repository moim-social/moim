import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Avatar, AvatarImage, AvatarFallback } from "~/components/ui/avatar";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Separator } from "~/components/ui/separator";
import { Alert, AlertDescription } from "~/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { useEventCategoryMap } from "~/hooks/useEventCategories";
import { languageLabel } from "~/shared/languages";
import { EmptyState, PageHeader } from "~/components/dashboard";
import { useGroupDashboard, addGroupMemberFn, removeGroupMemberFn, type GroupData } from "./route";

export const Route = createFileRoute("/groups/$identifier/dashboard/members")({
  component: MembersTab,
});

function MembersTab() {
  const { categoryMap } = useEventCategoryMap();
  const { data, refresh } = useGroupDashboard();
  const { group, members, followers } = data;

  const owners = members.filter((m: GroupData["members"][number]) => m.role === "owner");
  const moderators = members.filter((m: GroupData["members"][number]) => m.role === "moderator");

  // Add moderator dialog
  const [addModDialogOpen, setAddModDialogOpen] = useState(false);
  const [modHandle, setModHandle] = useState("");
  const [resolvedMod, setResolvedMod] = useState<{ handle: string; name: string; actorUrl: string } | null>(null);
  const [modResolving, setModResolving] = useState(false);
  const [modAdding, setModAdding] = useState(false);
  const [modError, setModError] = useState("");

  // Remove moderator
  const [removingMember, setRemovingMember] = useState<GroupData["members"][number] | null>(null);
  const [removeSubmitting, setRemoveSubmitting] = useState(false);

  async function resolveMod() {
    if (!modHandle.trim()) return;
    setModResolving(true);
    setModError("");
    setResolvedMod(null);
    try {
      const res = await fetch("/api/actors/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handle: modHandle.trim() }),
      });
      const result = await res.json();
      if (!res.ok) {
        setModError(result.error ?? "Failed to resolve handle");
      } else {
        setResolvedMod(result.actor);
      }
    } catch {
      setModError("Network error");
    }
    setModResolving(false);
  }

  async function addModerator() {
    if (!resolvedMod) return;
    setModAdding(true);
    setModError("");
    try {
      await addGroupMemberFn({ data: { groupActorId: group.id, handle: resolvedMod.handle } });
      setModHandle("");
      setResolvedMod(null);
      setAddModDialogOpen(false);
      refresh();
    } catch (err) {
      setModError(err instanceof Error ? err.message : "Failed to add moderator");
    }
    setModAdding(false);
  }

  async function removeModerator() {
    if (!removingMember) return;
    setRemoveSubmitting(true);
    try {
      await removeGroupMemberFn({ data: { groupActorId: group.id, handle: removingMember.handle } });
      setRemovingMember(null);
      refresh();
    } catch {
      // silently fail
    }
    setRemoveSubmitting(false);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Members & Followers"
        subtitle={`${members.length} members, ${followers.length} followers.`}
      />

      {/* About */}
      {group.summary && (
        <div className="rounded-lg border p-4 space-y-3">
          <p className="text-sm font-medium">About</p>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">
            {group.summary}
          </p>
          {group.website && (
            <a
              href={group.website}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="size-4"
              >
                <path
                  fillRule="evenodd"
                  d="M4.25 5.5a.75.75 0 0 0-.75.75v8.5c0 .414.336.75.75.75h8.5a.75.75 0 0 0 .75-.75v-4a.75.75 0 0 1 1.5 0v4A2.25 2.25 0 0 1 12.75 17h-8.5A2.25 2.25 0 0 1 2 14.75v-8.5A2.25 2.25 0 0 1 4.25 4h5a.75.75 0 0 1 0 1.5h-5Zm4.943.25a.75.75 0 0 1 0-1.5h5.057a.75.75 0 0 1 .75.75v5.057a.75.75 0 0 1-1.5 0V6.56l-5.22 5.22a.75.75 0 0 1-1.06-1.06l5.22-5.22H9.193Z"
                  clipRule="evenodd"
                />
              </svg>
              {group.website}
            </a>
          )}
          {group.categories &&
            (group.categories as string[]).length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {(group.categories as string[]).map((catId: string) => (
                  <Badge key={catId} variant="secondary">
                    {categoryMap.get(catId) ?? catId}
                  </Badge>
                ))}
              </div>
            )}
          {languageLabel(group.language) && (
            <p className="text-sm text-muted-foreground">
              Default language: {languageLabel(group.language)}
            </p>
          )}
        </div>
      )}

      {/* Members */}
      <div className="rounded-lg border p-4 space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">
            Members ({members.length})
          </p>
          {data.currentUserRole === "owner" && (
            <Button size="sm" variant="outline" onClick={() => { setAddModDialogOpen(true); setModError(""); setResolvedMod(null); setModHandle(""); }}>
              Add Moderator
            </Button>
          )}
        </div>
        {owners.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
              Owners
            </p>
            <ul className="space-y-1.5">
              {owners.map((m: GroupData["members"][number]) => (
                <MemberRow key={m.handle} member={m} />
              ))}
            </ul>
          </div>
        )}
        {moderators.length > 0 && (
          <>
            <Separator />
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                Moderators
              </p>
              <ul className="space-y-1.5">
                {moderators.map((m: GroupData["members"][number]) => (
                  <MemberRow
                    key={m.handle}
                    member={m}
                    canRemove={data.currentUserRole === "owner"}
                    onRemove={() => setRemovingMember(m)}
                  />
                ))}
              </ul>
            </div>
          </>
        )}
      </div>

      {/* Followers */}
      <div className="rounded-lg border p-4 space-y-3">
        <p className="text-sm font-medium">
          Followers ({followers.length})
        </p>
        {followers.length === 0 ? (
          <EmptyState message="No followers yet." />
        ) : (
          <ul className="space-y-1.5">
            {followers.map((f: GroupData["followers"][number]) => (
              <FollowerRow key={f.actorUrl} follower={f} />
            ))}
          </ul>
        )}
      </div>

      {/* Add Moderator Dialog */}
      <Dialog open={addModDialogOpen} onOpenChange={setAddModDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Moderator</DialogTitle>
            <DialogDescription>
              Enter a fediverse handle to add as a moderator of {group.name ?? `@${group.handle}`}.
            </DialogDescription>
          </DialogHeader>

          {modError && (
            <Alert variant="destructive">
              <AlertDescription>{modError}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="mod-handle">Fediverse Handle</Label>
              <div className="flex gap-2">
                <Input
                  id="mod-handle"
                  value={modHandle}
                  onChange={(e) => { setModHandle(e.target.value); setResolvedMod(null); }}
                  placeholder="alice@mastodon.social"
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); resolveMod(); } }}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={resolveMod}
                  disabled={modResolving || !modHandle.trim()}
                >
                  {modResolving ? "Looking up..." : "Look up"}
                </Button>
              </div>
            </div>

            {resolvedMod && (
              <div className="flex items-center gap-3 rounded-md border p-3">
                <div className="size-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold shrink-0">
                  {resolvedMod.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-sm font-medium">{resolvedMod.name}</span>
                  <span className="text-sm text-muted-foreground ml-1.5">@{resolvedMod.handle}</span>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAddModDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={addModerator}
              disabled={modAdding || !resolvedMod}
            >
              {modAdding ? "Adding..." : "Add Moderator"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove Moderator Confirmation Dialog */}
      <Dialog open={removingMember != null} onOpenChange={(open) => !open && setRemovingMember(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Moderator</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove <strong>@{removingMember?.handle}</strong> as a moderator?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemovingMember(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={removeModerator}
              disabled={removeSubmitting}
            >
              {removeSubmitting ? "Removing..." : "Remove"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MemberRow({
  member,
  canRemove,
  onRemove,
}: {
  member: { handle: string; name: string | null; avatarUrl?: string | null; isLocal: boolean };
  canRemove?: boolean;
  onRemove?: () => void;
}) {
  return (
    <li className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-accent/50 transition-colors">
      <Avatar className="size-8 shrink-0">
        {member.avatarUrl && <AvatarImage src={member.avatarUrl} alt={member.name ?? member.handle} />}
        <AvatarFallback className="text-xs font-semibold bg-primary/10 text-primary">
          {(member.name ?? member.handle).charAt(0).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <span className="text-sm font-medium">
          {member.name ?? member.handle}
        </span>
        <span className="text-sm text-muted-foreground ml-1.5">
          @{member.handle}
        </span>
      </div>
      {canRemove && onRemove && (
        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive text-xs h-7" onClick={onRemove}>
          Remove
        </Button>
      )}
      {!member.isLocal && (
        <Badge variant="secondary" className="text-xs shrink-0">
          fediverse
        </Badge>
      )}
    </li>
  );
}

function FollowerRow({
  follower,
}: {
  follower: {
    handle: string;
    name: string | null;
    avatarUrl?: string | null;
    actorUrl: string;
    domain: string | null;
    isLocal: boolean;
  };
}) {
  const displayHandle = follower.handle.includes("@")
    ? `@${follower.handle}`
    : `@${follower.handle}@${follower.domain}`;

  return (
    <li className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-accent/50 transition-colors">
      <Avatar className="size-8 shrink-0">
        {follower.avatarUrl && <AvatarImage src={follower.avatarUrl} alt={follower.name ?? follower.handle} />}
        <AvatarFallback className="text-xs font-semibold bg-primary/10 text-primary">
          {(follower.name ?? follower.handle).charAt(0).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <span className="text-sm font-medium">
          {follower.name ?? follower.handle}
        </span>
        <span className="text-sm text-muted-foreground ml-1.5">
          {displayHandle}
        </span>
      </div>
      {!follower.isLocal && (
        <Badge variant="secondary" className="text-xs shrink-0">
          {follower.domain}
        </Badge>
      )}
    </li>
  );
}
