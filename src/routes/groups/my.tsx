import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "~/components/ui/button";
import { languageLabel } from "~/shared/languages";
import { Avatar, AvatarImage, AvatarFallback } from "~/components/ui/avatar";

export const Route = createFileRoute("/groups/my")({
  component: MyGroupsPage,
});

type GroupSummary = {
  id: string;
  handle: string;
  name: string | null;
  summary: string | null;
  categories: string[] | null;
  language: string | null;
  avatarUrl: string | null;
  role: string;
  followersCount: number;
  membersCount: number;
  upcomingEventsCount: number;
  pastEventsCount: number;
};

function MyGroupsPage() {
  const navigate = useNavigate();
  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/session")
      .then((r) => r.json())
      .then((data) => {
        if (!data.user) {
          navigate({ to: "/auth/signin", search: { returnTo: "/groups/my" } });
          return;
        }
        return fetch("/api/me/groups");
      })
      .then((r) => r?.json())
      .then((data) => {
        if (data?.groups) setGroups(data.groups);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, [navigate]);

  if (loading) {
    return <p className="text-muted-foreground">Loading...</p>;
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b-2 border-foreground mb-6">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight">My Groups</h2>
          <p className="text-sm text-[#888] mt-1">Groups you host or moderate.</p>
        </div>
        <Button size="sm" asChild>
          <Link to="/groups/create">Create Group</Link>
        </Button>
      </div>

      {groups.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-[15px] font-semibold text-[#888]">No groups yet</p>
          <p className="text-[13px] text-[#bbb] mt-1">Create a group to start hosting events.</p>
        </div>
      ) : (
        <div className="divide-y divide-[#f0f0f0]">
          {groups.map((group) => (
            <Link
              key={group.id}
              to="/groups/$identifier/dashboard"
              params={{ identifier: `@${group.handle}` }}
              className="flex items-start gap-4 py-5 first:pt-0 hover:bg-[#fafafa] transition-colors group"
            >
              <Avatar className="size-11 shrink-0">
                {group.avatarUrl && <AvatarImage src={group.avatarUrl} alt={group.name ?? group.handle} />}
                <AvatarFallback className="text-sm font-semibold bg-muted text-muted-foreground">
                  {(group.name ?? group.handle).charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[15px] font-bold tracking-tight truncate group-hover:underline">
                    {group.name ?? group.handle}
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-wide text-[#555] border border-[#ddd] px-1.5 py-0 shrink-0">
                    {group.role}
                  </span>
                </div>
                <p className="text-[12px] text-[#999] mt-0.5">@{group.handle}</p>

                {/* Stats row */}
                <div className="flex flex-wrap items-center gap-x-3 text-[12px] text-[#888] mt-2">
                  <span><strong className="text-[#333]">{group.followersCount}</strong> followers</span>
                  <span><strong className="text-[#333]">{group.membersCount}</strong> members</span>
                  {group.upcomingEventsCount > 0 && (
                    <span><strong className="text-[#333]">{group.upcomingEventsCount}</strong> upcoming</span>
                  )}
                  {languageLabel(group.language) && (
                    <span>{languageLabel(group.language)}</span>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
