import { useState, useEffect, useRef } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Badge } from "~/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "~/components/ui/avatar";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/admin/groups")({
  component: AdminGroupsPage,
});

type GroupRow = {
  id: string;
  handle: string;
  name: string | null;
  avatarUrl: string | null;
  verified: boolean;
  followersCount: number;
  createdAt: string;
};

const LIMIT = 50;

function AdminGroupsPage() {
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const [toggling, setToggling] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchGroups = (q: string, off: number) => {
    setLoading(true);
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    params.set("limit", String(LIMIT));
    params.set("offset", String(off));
    fetch(`/api/admin/groups?${params}`)
      .then((r) => r.json())
      .then((data) => {
        setGroups(data.groups ?? []);
        setTotal(data.total ?? 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setOffset(0);
      fetchGroups(search, 0);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search]);

  useEffect(() => {
    fetchGroups(search, offset);
  }, [offset]);

  async function toggleVerified(group: GroupRow) {
    setToggling(group.id);
    try {
      const res = await fetch("/api/admin/groups", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: group.id, verified: !group.verified }),
      });
      if (res.ok) {
        setGroups((prev) =>
          prev.map((g) =>
            g.id === group.id ? { ...g, verified: !g.verified } : g,
          ),
        );
      }
    } catch {
      // ignore
    }
    setToggling(null);
  }

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Groups</h2>
        <p className="mt-1 text-muted-foreground">
          Manage groups and set official status.
        </p>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          placeholder="Search by handle or name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <p className="text-muted-foreground">Loading groups...</p>
        </div>
      ) : groups.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <p className="text-muted-foreground">
            {search ? "No groups match your search." : "No groups found."}
          </p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-left font-medium">Group</th>
                  <th className="px-4 py-3 text-center font-medium">Followers</th>
                  <th className="px-4 py-3 text-center font-medium">Status</th>
                  <th className="px-4 py-3 text-left font-medium">Created</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {groups.map((group) => (
                  <tr
                    key={group.id}
                    className="border-b last:border-0 hover:bg-muted/30"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar>
                          {group.avatarUrl ? (
                            <AvatarImage src={group.avatarUrl} alt="" />
                          ) : null}
                          <AvatarFallback>
                            {(group.name ?? group.handle).charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="font-medium truncate max-w-[200px]">
                            {group.name ?? group.handle}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            @{group.handle}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge variant="secondary">{group.followersCount}</Badge>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {group.verified ? (
                        <Badge variant="default">Official</Badge>
                      ) : (
                        <Badge variant="secondary">Unverified</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {formatDate(group.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant={group.verified ? "outline" : "default"}
                        size="sm"
                        disabled={toggling === group.id}
                        onClick={() => toggleVerified(group)}
                      >
                        {toggling === group.id
                          ? "..."
                          : group.verified
                            ? "Remove Official"
                            : "Mark Official"}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Showing {offset + 1}–{Math.min(offset + LIMIT, total)} of {total}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={offset === 0}
                onClick={() => setOffset(Math.max(0, offset - LIMIT))}
              >
                <ChevronLeft className="size-4 mr-1" />
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={offset + LIMIT >= total}
                onClick={() => setOffset(offset + LIMIT)}
              >
                Next
                <ChevronRight className="size-4 ml-1" />
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
