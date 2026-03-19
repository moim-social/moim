import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { languageLabel } from "~/shared/languages";
import { Avatar, AvatarImage, AvatarFallback } from "~/components/ui/avatar";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";

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
          navigate({ to: "/auth/signin" });
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">My Groups</h2>
          <p className="text-muted-foreground mt-1">
            Groups you host or moderate.
          </p>
        </div>
        <Button asChild>
          <Link to="/groups/create">Create Group</Link>
        </Button>
      </div>

      {groups.length === 0 ? (
        <Card className="flex items-center justify-center py-16 rounded-lg">
          <CardHeader className="text-center">
            <CardTitle className="text-base text-muted-foreground">
              No groups yet
            </CardTitle>
            <CardDescription>
              Create a group to start hosting events.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="divide-y border-t border-b">
          {groups.map((group) => (
            <Link
              key={group.id}
              to="/groups/$identifier/dashboard"
              params={{ identifier: `@${group.handle}` }}
              className="flex items-center gap-3 py-4 px-2 hover:bg-[#fafafa] transition-colors"
            >
              <Avatar className="size-10 shrink-0">
                {group.avatarUrl && <AvatarImage src={group.avatarUrl} alt={group.name ?? group.handle} />}
                <AvatarFallback className="text-sm font-semibold bg-muted text-muted-foreground">
                  {(group.name ?? group.handle).charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold truncate">
                    {group.name ?? group.handle}
                  </span>
                  <Badge variant="outline" className="text-xs shrink-0 uppercase tracking-wide">
                    {group.role}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">@{group.handle}</p>
                <div className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                  <span>
                    {group.followersCount} follower{group.followersCount !== 1 ? "s" : ""}
                    {" · "}
                    {group.membersCount} member{group.membersCount !== 1 ? "s" : ""}
                    {languageLabel(group.language) && (
                      <>{" · "}{languageLabel(group.language)}</>
                    )}
                  </span>
                  <span>
                    {group.upcomingEventsCount + group.pastEventsCount} event{group.upcomingEventsCount + group.pastEventsCount !== 1 ? "s" : ""}
                    {group.upcomingEventsCount > 0 && (
                      <span className="font-medium ml-1">
                        ({group.upcomingEventsCount} upcoming)
                      </span>
                    )}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
