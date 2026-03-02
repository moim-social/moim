import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "~/components/ui/avatar";
import {
  Card,
  CardContent,
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
    fetch("/auth/me")
      .then((r) => r.json())
      .then((data) => {
        if (!data.user) {
          navigate({ to: "/auth/signin" });
          return;
        }
        return fetch("/groups/my-groups");
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
        <div className="grid gap-3">
          {groups.map((group) => (
            <Card key={group.id} className="rounded-lg py-2 gap-0 transition-colors hover:bg-accent/50">
              <Link
                to="/groups/$identifier/dashboard"
                params={{ identifier: `@${group.handle}` }}
                className="block"
              >
                <CardContent className="py-2">
                  <div className="flex items-center gap-4">
                    <Avatar className="size-10 shrink-0">
                      {group.avatarUrl && <AvatarImage src={group.avatarUrl} alt={group.name ?? group.handle} />}
                      <AvatarFallback className="text-sm font-semibold bg-primary/10 text-primary">
                        {(group.name ?? group.handle).charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold truncate">
                          {group.name ?? group.handle}
                        </span>
                        <Badge variant="outline" className="text-xs shrink-0">
                          {group.role}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">@{group.handle}</p>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground shrink-0">
                      <span>{group.followersCount} follower{group.followersCount !== 1 ? "s" : ""}</span>
                      <span>{group.membersCount} member{group.membersCount !== 1 ? "s" : ""}</span>
                      <span>
                        {group.upcomingEventsCount + group.pastEventsCount} event{group.upcomingEventsCount + group.pastEventsCount !== 1 ? "s" : ""}
                        {group.upcomingEventsCount > 0 && (
                          <span className="text-primary font-medium ml-1">
                            ({group.upcomingEventsCount} upcoming)
                          </span>
                        )}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Link>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
