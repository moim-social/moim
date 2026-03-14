import { createFileRoute } from "@tanstack/react-router";
import { Badge } from "~/components/ui/badge";
import { Separator } from "~/components/ui/separator";
import { useEventCategoryMap } from "~/hooks/useEventCategories";
import { languageLabel } from "~/shared/languages";
import { EmptyState, PageHeader } from "~/components/dashboard";
import { useGroupDashboard } from "./route";

export const Route = createFileRoute("/groups/$identifier/dashboard/members")({
  component: MembersTab,
});

function MembersTab() {
  const { categoryMap } = useEventCategoryMap();
  const { data } = useGroupDashboard();
  const { group, members, followers } = data;

  const owners = members.filter((m) => m.role === "owner");
  const moderators = members.filter((m) => m.role === "moderator");

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
                {(group.categories as string[]).map((catId) => (
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
        <p className="text-sm font-medium">
          Members ({members.length})
        </p>
        {owners.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
              Owners
            </p>
            <ul className="space-y-1.5">
              {owners.map((m) => (
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
                {moderators.map((m) => (
                  <MemberRow key={m.handle} member={m} />
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
            {followers.map((f) => (
              <FollowerRow key={f.actorUrl} follower={f} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function MemberRow({
  member,
}: {
  member: { handle: string; name: string | null; isLocal: boolean };
}) {
  return (
    <li className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-accent/50 transition-colors">
      <div className="size-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold shrink-0">
        {(member.name ?? member.handle).charAt(0).toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <span className="text-sm font-medium">
          {member.name ?? member.handle}
        </span>
        <span className="text-sm text-muted-foreground ml-1.5">
          @{member.handle}
        </span>
      </div>
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
      <div className="size-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold shrink-0">
        {(follower.name ?? follower.handle).charAt(0).toUpperCase()}
      </div>
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
