import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { ExternalLink } from "lucide-react";
import { RemoteDiscussionDialog } from "~/components/RemoteDiscussionDialog";
import { Trans } from "@lingui/react";
import type { PublicInquiry, ThreadMessage } from "~/hooks/useEventDetail";

function buildThreadTree<T extends { id: string; inReplyToPostId: string | null }>(
  messages: T[],
  rootId: string,
): { msg: T; depth: number }[] {
  const nonRoot = messages.filter((m) => m.id !== rootId);
  const childrenMap = new Map<string, T[]>();
  const roots: T[] = [];

  for (const msg of nonRoot) {
    const parentId = msg.inReplyToPostId;
    if (!parentId || parentId === rootId || !nonRoot.some((m) => m.id === parentId)) {
      roots.push(msg);
    } else {
      const siblings = childrenMap.get(parentId) ?? [];
      siblings.push(msg);
      childrenMap.set(parentId, siblings);
    }
  }

  const result: { msg: T; depth: number }[] = [];
  const walk = (node: T, depth: number) => {
    result.push({ msg: node, depth });
    for (const child of childrenMap.get(node.id) ?? []) {
      walk(child, depth + 1);
    }
  };
  for (const root of roots) {
    walk(root, 0);
  }
  return result;
}

function stripMentionHtml(html: string): string {
  let result = html.replace(
    /<span[^>]*class="[^"]*h-card[^"]*"[^>]*>(<a[^>]*class="[^"]*mention[^"]*"[^>]*>[\s\S]*?<\/a>)<\/span>/g,
    "",
  );
  result = result.replace(
    /<a[^>]*class="[^"]*mention[^"]*"[^>]*>[\s\S]*?<\/a>/g,
    "",
  );
  result = result
    .replace(/<p>\s*<\/p>/g, "")
    .replace(/<p>\s+/g, "<p>")
    .trim();
  return result;
}

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function PublicDiscussions({
  inquiries,
  eventNoteApUrl,
  expandedId,
  threadCache,
  threadLoading,
  onToggleThread,
}: {
  inquiries: PublicInquiry[];
  eventNoteApUrl: string | null;
  expandedId: string | null;
  threadCache: Record<string, ThreadMessage[]>;
  threadLoading: string | null;
  onToggleThread: (inquiryId: string) => void;
}) {
  return (
    <Card className="rounded-lg">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-xs font-bold uppercase tracking-wide text-[#333]">
            <Trans id="Discussion" message="Discussion" />
          </CardTitle>
          {eventNoteApUrl && inquiries.length > 0 && (
            <RemoteDiscussionDialog apUrl={eventNoteApUrl} />
          )}
        </div>
      </CardHeader>
      <CardContent>
        {inquiries.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <p className="text-sm text-muted-foreground">
              <Trans id="No discussions yet." message="No discussions yet." />
            </p>
            {eventNoteApUrl && (
              <RemoteDiscussionDialog apUrl={eventNoteApUrl} />
            )}
          </div>
        ) : (
          <ul className="divide-y">
            {inquiries.map((inq) => {
              const isExpanded = expandedId === inq.id;
              const replies = threadCache[inq.id];
              const isLoading = threadLoading === inq.id;

              return (
                <li key={inq.id} className="group/inq py-3 first:pt-0 last:pb-0">
                  <button
                    type="button"
                    className="w-full text-left"
                    onClick={() => inq.replyCount > 0 && onToggleThread(inq.id)}
                  >
                    <div className="flex items-start gap-3">
                      {inq.actorAvatarUrl ? (
                        <img
                          src={inq.actorAvatarUrl}
                          alt=""
                          className="size-8 rounded-full shrink-0"
                        />
                      ) : (
                        <div className="size-8 rounded-full bg-muted flex items-center justify-center text-xs font-semibold shrink-0">
                          {(inq.actorName ?? inq.actorHandle)?.[0]?.toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-sm font-medium truncate">
                            {inq.actorName ?? inq.actorHandle}
                          </span>
                          <span className="text-xs text-muted-foreground truncate">
                            @{inq.actorHandle}{inq.actorDomain && !inq.actorHandle.includes("@") ? `@${inq.actorDomain}` : ""}
                          </span>
                          <span className="text-xs text-muted-foreground ml-auto shrink-0">
                            {formatRelativeTime(inq.lastRepliedAt ?? inq.createdAt)}
                          </span>
                        </div>
                        <div className="flex items-start gap-2 mt-1">
                          <div
                            className="text-sm text-muted-foreground line-clamp-3 prose prose-sm max-w-none [&_p]:my-0.5 flex-1 min-w-0"
                            dangerouslySetInnerHTML={{ __html: stripMentionHtml(inq.content) }}
                          />
                          {inq.apUrl && (
                            <span className="shrink-0 opacity-0 group-hover/inq:opacity-100 transition-opacity">
                              <RemoteDiscussionDialog
                                apUrl={inq.apUrl}
                                triggerLabel={<><ExternalLink className="size-3" /> Reply</>}
                                variant="ghost"
                              />
                            </span>
                          )}
                        </div>
                        {inq.replyCount > 0 && (
                          <p className="text-xs text-primary mt-1.5">
                            {isExpanded ? "Hide" : "Show"} {inq.replyCount} {inq.replyCount === 1 ? "reply" : "replies"}
                          </p>
                        )}
                      </div>
                    </div>
                  </button>

                  {/* Expanded thread */}
                  {isExpanded && (
                    <div className="mt-3 ml-11 divide-y">
                      {isLoading ? (
                        <p className="text-xs text-muted-foreground py-2"><Trans id="Loading..." message="Loading..." /></p>
                      ) : replies ? (
                        buildThreadTree(replies, inq.id).map(({ msg: m, depth }) => (
                          <div
                            key={m.id}
                            className="group/reply flex items-start gap-2 py-2"
                            style={{ paddingLeft: `${Math.min(depth, 4) * 16}px` }}
                          >
                            {m.actorAvatarUrl ? (
                              <img
                                src={m.actorAvatarUrl}
                                alt=""
                                className="size-5 rounded-full shrink-0 mt-0.5"
                              />
                            ) : (
                              <div className="size-5 rounded-full bg-muted flex items-center justify-center text-[10px] font-semibold shrink-0 mt-0.5">
                                {(m.actorName ?? m.actorHandle)?.[0]?.toUpperCase()}
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <div className="flex items-baseline gap-1.5 flex-wrap">
                                <span className="text-xs font-semibold">
                                  {m.actorName ?? m.actorHandle}
                                </span>
                                <span className="text-[10px] text-muted-foreground">
                                  @{m.actorHandle}{m.actorDomain && !m.actorHandle.includes("@") ? `@${m.actorDomain}` : ""}
                                </span>
                                <span className="text-[10px] text-muted-foreground">
                                  {formatRelativeTime(m.createdAt)}
                                </span>
                                {m.apUrl && (
                                  <span className="opacity-0 group-hover/reply:opacity-100 transition-opacity">
                                    <RemoteDiscussionDialog
                                      apUrl={m.apUrl}
                                      triggerLabel={<><ExternalLink className="size-3" /> Reply</>}
                                      variant="ghost"
                                    />
                                  </span>
                                )}
                              </div>
                              <div
                                className="text-xs text-muted-foreground mt-0.5 prose prose-xs max-w-none [&_p]:my-0.5"
                                dangerouslySetInnerHTML={{ __html: stripMentionHtml(m.content) }}
                              />
                            </div>
                          </div>
                        ))
                      ) : null}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
