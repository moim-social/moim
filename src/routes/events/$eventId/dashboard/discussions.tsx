import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Separator } from "~/components/ui/separator";
import {
  ArrowLeft,
  Send,
  Check,
  RotateCcw,
  Reply,
  X,
  Globe,
  Unlock,
  Users,
  Lock,
} from "lucide-react";
import { useDashboard } from "./route";

export const Route = createFileRoute(
  "/events/$eventId/dashboard/discussions",
)({
  component: DiscussionsTab,
});

type InquiryItem = {
  id: string;
  content: string;
  published: string;
  createdAt: string;
  threadStatus: string | null;
  lastRepliedAt: string | null;
  visibility: string | null;
  actorId: string;
  actorHandle: string;
  actorName: string | null;
  actorAvatarUrl: string | null;
  actorDomain: string | null;
  replyCount: number;
  participantCount: number;
};

type ThreadMessage = {
  id: string;
  content: string;
  published: string;
  createdAt: string;
  inReplyToPostId: string | null;
  visibility: string | null;
  actorId: string;
  actorHandle: string;
  actorName: string | null;
  actorAvatarUrl: string | null;
  actorDomain: string | null;
  actorIsLocal: boolean;
};

type Participant = {
  actorId: string;
  actorHandle: string;
  actorName: string | null;
  actorAvatarUrl: string | null;
  actorDomain: string | null;
  actorIsLocal: boolean;
};

type StatusCounts = {
  total: number;
  new: number;
  needsResponse: number;
  resolved: number;
};

const STATUS_FILTERS: { key: string | null; label: string }[] = [
  { key: null, label: "All" },
  { key: "new", label: "New" },
  { key: "needs_response", label: "Needs Response" },
  { key: "resolved", label: "Resolved" },
];

function DiscussionsTab() {
  const { eventId } = Route.useParams();
  const navigate = useNavigate();
  const { data } = useDashboard();
  const isGroupEvent = !!data.event.groupActorId;

  // Inquiry list state
  const [inquiries, setInquiries] = useState<InquiryItem[]>([]);
  const [counts, setCounts] = useState<StatusCounts>({
    total: 0,
    new: 0,
    needsResponse: 0,
    resolved: 0,
  });
  const [listLoading, setListLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  // Selected inquiry state
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [groupActorId, setGroupActorId] = useState<string | null>(null);
  const [threadStatus, setThreadStatus] = useState<string | null>(null);
  const [threadLoading, setThreadLoading] = useState(false);

  // Reply state
  const [replyContent, setReplyContent] = useState("");
  const [replyingTo, setReplyingTo] = useState<ThreadMessage | null>(null);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Set reply target: set "replying to" indicator and prepend reply target's handle
  const startReplyTo = (msg: ThreadMessage) => {
    setReplyingTo(msg);
    const handle = `@${msg.actorHandle}`;
    const prefix = `${handle} `;
    setReplyContent(prefix);
    requestAnimationFrame(() => {
      const ta = textareaRef.current;
      if (ta) {
        ta.focus();
        ta.setSelectionRange(prefix.length, prefix.length);
      }
    });
  };

  // Fetch inquiry list
  const fetchInquiries = useCallback(() => {
    if (!isGroupEvent) return;
    setListLoading(true);
    const params = new URLSearchParams();
    if (statusFilter) params.set("status", statusFilter);

    fetch(`/api/events/${eventId}/discussions?${params}`)
      .then((r) => r.json())
      .then((data) => {
        setInquiries(data.inquiries ?? []);
        setCounts(data.counts ?? { total: 0, new: 0, needsResponse: 0, resolved: 0 });
      })
      .catch(() => {})
      .finally(() => setListLoading(false));
  }, [eventId, statusFilter, isGroupEvent]);

  useEffect(() => {
    fetchInquiries();
  }, [fetchInquiries]);

  // Fetch thread detail
  const fetchThread = useCallback(
    (inquiryId: string) => {
      setThreadLoading(true);
      fetch(`/api/events/${eventId}/discussions/${inquiryId}`)
        .then((r) => r.json())
        .then((data) => {
          setMessages(data.messages ?? []);
          setParticipants(data.participants ?? []);
          setGroupActorId(data.groupActorId ?? null);
          setThreadStatus(data.threadStatus ?? null);
        })
        .catch(() => {})
        .finally(() => setThreadLoading(false));
    },
    [eventId],
  );

  useEffect(() => {
    if (selectedId) {
      fetchThread(selectedId);
      setReplyContent("");
      setReplyingTo(null);
    }
  }, [selectedId, fetchThread]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Redirect if not a group event
  useEffect(() => {
    if (!isGroupEvent) {
      navigate({
        to: "/events/$eventId/dashboard",
        params: { eventId },
        replace: true,
      });
    }
  }, [isGroupEvent, eventId, navigate]);

  if (!isGroupEvent) return null;

  // Handle reply submit
  const handleSubmitReply = async () => {
    if (!selectedId || !replyContent.trim() || sending) return;
    setSending(true);

    try {
      const res = await fetch(
        `/api/events/${eventId}/discussions/${selectedId}/replies`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: replyContent.trim(),
            parentPostId: replyingTo?.id,
          }),
        },
      );

      if (res.ok) {
        setReplyContent("");
        setReplyingTo(null);
        fetchThread(selectedId);
        fetchInquiries();
      }
    } catch {
      // ignore
    } finally {
      setSending(false);
    }
  };

  // Handle status update
  const handleStatusUpdate = async (newStatus: string) => {
    if (!selectedId) return;

    try {
      const res = await fetch(
        `/api/events/${eventId}/discussions/${selectedId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ threadStatus: newStatus }),
        },
      );

      if (res.ok) {
        setThreadStatus(newStatus);
        fetchInquiries();
      }
    } catch {
      // ignore
    }
  };

  // Build threaded message tree with depth for indentation
  const threadedMessages = useMemo(() => {
    if (messages.length === 0) return [];

    // Build children map
    const childrenMap = new Map<string, ThreadMessage[]>();
    const rootMessages: ThreadMessage[] = [];

    for (const msg of messages) {
      if (
        !msg.inReplyToPostId ||
        !messages.some((m) => m.id === msg.inReplyToPostId)
      ) {
        // Root message or parent not in this thread
        rootMessages.push(msg);
      } else {
        const siblings = childrenMap.get(msg.inReplyToPostId) ?? [];
        siblings.push(msg);
        childrenMap.set(msg.inReplyToPostId, siblings);
      }
    }

    // Flatten tree with depth via DFS
    const result: { msg: ThreadMessage; depth: number }[] = [];
    const walk = (node: ThreadMessage, depth: number) => {
      result.push({ msg: node, depth });
      const children = childrenMap.get(node.id) ?? [];
      for (const child of children) {
        walk(child, depth + 1);
      }
    };
    for (const root of rootMessages) {
      walk(root, 0);
    }
    return result;
  }, [messages]);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Discussions</h2>
        <p className="mt-1 text-muted-foreground">
          Manage attendee inquiries and conversations.
        </p>
      </div>

      <div className="flex min-h-[calc(100vh-16rem)] rounded-lg border">
        {/* Left panel: Inquiry list */}
        <div className="w-72 shrink-0 border-r flex flex-col">
          {/* Status filters */}
          <div className="flex gap-1 p-2 border-b flex-wrap">
            {STATUS_FILTERS.map((f) => (
              <Button
                key={f.key ?? "all"}
                variant={statusFilter === f.key ? "default" : "outline"}
                size="sm"
                className="text-xs h-6 px-2"
                onClick={() => {
                  setStatusFilter(f.key);
                  setSelectedId(null);
                }}
              >
                {f.label}
                {f.key === "new" && counts.new > 0 && (
                  <Badge
                    variant="secondary"
                    className="ml-1 h-4 px-1 text-[10px]"
                  >
                    {counts.new}
                  </Badge>
                )}
                {f.key === "needs_response" && counts.needsResponse > 0 && (
                  <Badge
                    variant="secondary"
                    className="ml-1 h-4 px-1 text-[10px]"
                  >
                    {counts.needsResponse}
                  </Badge>
                )}
              </Button>
            ))}
          </div>

          {/* Inquiry items */}
          <div className="flex-1 overflow-y-auto">
            {listLoading ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                Loading...
              </p>
            ) : inquiries.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                No discussions yet.
              </p>
            ) : (
              <ul>
                {inquiries.map((inq) => (
                  <li key={inq.id}>
                    <button
                      type="button"
                      className={`w-full text-left p-3 border-b transition-colors hover:bg-muted/30 ${
                        selectedId === inq.id ? "bg-muted/50" : ""
                      }`}
                      onClick={() => setSelectedId(inq.id)}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        {inq.actorAvatarUrl ? (
                          <img
                            src={inq.actorAvatarUrl}
                            alt=""
                            className="size-6 rounded-full"
                          />
                        ) : (
                          <div className="size-6 rounded-full bg-muted flex items-center justify-center text-xs">
                            {(inq.actorName ?? inq.actorHandle)?.[0]?.toUpperCase()}
                          </div>
                        )}
                        <span className="text-sm font-medium truncate flex-1">
                          @{inq.actorHandle}
                          {inq.actorDomain && (
                            <span className="text-muted-foreground">
                              @{inq.actorDomain}
                            </span>
                          )}
                        </span>
                        <VisibilityIcon visibility={inq.visibility} />
                        <StatusDot status={inq.threadStatus} />
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {stripHtml(inq.content)}
                      </p>
                      <div className="flex items-center gap-2 mt-1.5 text-[10px] text-muted-foreground">
                        <span>
                          {inq.replyCount}{" "}
                          {inq.replyCount === 1 ? "reply" : "replies"}
                        </span>
                        <span>
                          {formatRelativeTime(
                            inq.lastRepliedAt ?? inq.createdAt,
                          )}
                        </span>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Right panel: Conversation thread */}
        <div className="flex-1 flex flex-col min-w-0">
          {selectedId === null ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
              Select a conversation to view
            </div>
          ) : threadLoading ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
              Loading conversation...
            </div>
          ) : (
            <>
              {/* Thread header */}
              <div className="flex items-center justify-between p-3 border-b">
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="md:hidden h-7 w-7 p-0"
                    onClick={() => setSelectedId(null)}
                  >
                    <ArrowLeft className="size-4" />
                  </Button>
                  <StatusBadge status={threadStatus} />
                  <span className="text-sm text-muted-foreground">
                    {messages.length}{" "}
                    {messages.length === 1 ? "message" : "messages"}
                  </span>
                </div>
                <div className="flex gap-1">
                  {threadStatus !== "resolved" ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => handleStatusUpdate("resolved")}
                    >
                      <Check className="size-3 mr-1" />
                      Resolve
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => handleStatusUpdate("new")}
                    >
                      <RotateCcw className="size-3 mr-1" />
                      Reopen
                    </Button>
                  )}
                </div>
              </div>

              {/* Messages — forum-style threaded view */}
              <div className="flex-1 overflow-y-auto">
                <div className="divide-y">
                  {threadedMessages.map(({ msg, depth }) => {
                    const isOrganizer = msg.actorId === groupActorId;
                    const indent = Math.min(depth, 4);

                    return (
                      <div
                        key={msg.id}
                        id={`msg-${msg.id}`}
                        className={`group hover:bg-muted/20 ${isOrganizer ? "bg-primary/5" : ""}`}
                        style={{ paddingLeft: `${indent * 24 + 12}px` }}
                      >
                        <div className="flex items-start gap-2 py-2 pr-3">
                          {/* Reply icon for nested messages */}
                          {depth > 0 && (
                            <Reply className="size-3 text-muted-foreground mt-1 shrink-0 rotate-180" />
                          )}

                          {/* Avatar */}
                          {msg.actorAvatarUrl ? (
                            <img
                              src={msg.actorAvatarUrl}
                              alt=""
                              className="size-5 rounded-full mt-0.5 shrink-0"
                            />
                          ) : (
                            <div className="size-5 rounded-full bg-muted flex items-center justify-center text-[10px] mt-0.5 shrink-0">
                              {(msg.actorName ?? msg.actorHandle)?.[0]?.toUpperCase()}
                            </div>
                          )}

                          {/* Content */}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-baseline gap-1.5">
                              <span className="text-xs font-semibold truncate">
                                {msg.actorName ?? msg.actorHandle}
                              </span>
                              <span className="text-[10px] text-muted-foreground truncate">
                                @{msg.actorHandle}
                              </span>
                              {isOrganizer && (
                                <Badge variant="secondary" className="text-[9px] h-3.5 px-1 shrink-0">
                                  Organizer
                                </Badge>
                              )}
                            </div>
                            <div
                              className="text-xs mt-0.5 prose prose-xs max-w-none [&_p]:my-0.5"
                              dangerouslySetInnerHTML={{ __html: stripMentions(msg.content) }}
                            />
                          </div>

                          {/* Timestamp + reply button, right-aligned */}
                          <div className="flex items-center gap-1 shrink-0 ml-auto">
                            <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                              {new Date(msg.createdAt).toLocaleString(
                                undefined,
                                {
                                  month: "short",
                                  day: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                },
                              )}
                            </span>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                              onClick={() => startReplyTo(msg)}
                            >
                              <Reply className="size-3" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>
              </div>

              <Separator />

              {/* Reply composer */}
              <div className="p-3">
                {replyingTo && (
                  <div className="flex items-center gap-2 mb-2 text-xs text-muted-foreground bg-muted/30 rounded px-2 py-1">
                    <Reply className="size-3 rotate-180" />
                    <span>
                      Replying to @
                      {replyingTo.actorName ?? replyingTo.actorHandle}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-4 w-4 p-0 ml-auto"
                      onClick={() => {
                        setReplyingTo(null);
                        setReplyContent("");
                      }}
                    >
                      <X className="size-3" />
                    </Button>
                  </div>
                )}
                <div className="flex gap-2">
                  <textarea
                    ref={textareaRef}
                    value={replyContent}
                    onChange={(e) => setReplyContent(e.target.value)}
                    placeholder="Write a reply..."
                    className="flex-1 min-h-[60px] max-h-[120px] resize-y rounded-md border bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                        handleSubmitReply();
                      }
                    }}
                  />
                  <Button
                    size="sm"
                    disabled={!replyContent.trim() || sending}
                    onClick={handleSubmitReply}
                    className="self-end"
                  >
                    <Send className="size-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function VisibilityIcon({ visibility }: { visibility: string | null }) {
  const iconClass = "size-3 text-muted-foreground";
  switch (visibility) {
    case "public":
      return <span title="Public" className="shrink-0"><Globe className={iconClass} /></span>;
    case "unlisted":
      return <span title="Unlisted" className="shrink-0"><Unlock className={iconClass} /></span>;
    case "followers_only":
      return <span title="Followers only" className="shrink-0"><Users className={iconClass} /></span>;
    case "direct":
      return <span title="Direct" className="shrink-0"><Lock className={iconClass} /></span>;
    default:
      return <span title="Public" className="shrink-0"><Globe className={iconClass} /></span>;
  }
}

function StatusDot({ status }: { status: string | null }) {
  const color =
    status === "new"
      ? "bg-blue-500"
      : status === "needs_response"
        ? "bg-amber-500"
        : status === "resolved"
          ? "bg-green-500"
          : "bg-gray-400";
  return <span className={`size-2 rounded-full shrink-0 ${color}`} />;
}

function StatusBadge({ status }: { status: string | null }) {
  const variant =
    status === "resolved" ? ("secondary" as const) : ("default" as const);
  const label =
    status === "new"
      ? "New"
      : status === "needs_response"
        ? "Needs Response"
        : status === "resolved"
          ? "Resolved"
          : "Unknown";
  return (
    <Badge variant={variant} className="text-xs">
      {label}
    </Badge>
  );
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").trim();
}

function stripMentions(html: string): string {
  // Remove <span class="h-card"> wrappers around mention links
  let result = html.replace(
    /<span[^>]*class="[^"]*h-card[^"]*"[^>]*>(<a[^>]*class="[^"]*mention[^"]*"[^>]*>[\s\S]*?<\/a>)<\/span>/g,
    "",
  );
  // Remove <a> mention links (may contain nested <span> elements)
  result = result.replace(
    /<a[^>]*class="[^"]*mention[^"]*"[^>]*>[\s\S]*?<\/a>/g,
    "",
  );
  // Clean up empty <p> tags and leading whitespace in <p>
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
