import { createFileRoute, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { zodValidator } from "@tanstack/zod-adapter";
import { useEffect, useState } from "react";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "~/server/db/client";
import { polls, actors } from "~/server/db/schema";
import { env } from "~/server/env";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { GaugeBar } from "~/components/dashboard/GaugeBar";
import { RemoteVoteDialog } from "~/components/RemoteVoteDialog";

const getPollMeta = createServerFn({ method: "GET" })
  .inputValidator(zodValidator(z.object({ pollId: z.string() })))
  .handler(async ({ data }) => {
    const [poll] = await db
      .select({
        question: polls.question,
        questionId: polls.questionId,
        type: polls.type,
        groupActorId: polls.groupActorId,
      })
      .from(polls)
      .where(eq(polls.id, data.pollId))
      .limit(1);
    if (!poll) return null;

    // Only group polls are publicly accessible
    const [group] = await db
      .select({
        name: actors.name,
        handle: actors.handle,
        domain: actors.domain,
      })
      .from(actors)
      .where(and(eq(actors.id, poll.groupActorId), eq(actors.type, "Group")))
      .limit(1);

    if (!group) return null;

    return {
      question: poll.question,
      type: poll.type,
      groupName: group?.name ?? null,
      groupHandle: group?.handle ?? null,
      groupDomain: group?.domain ?? null,
      apUrl: `${env.baseUrl}/ap/questions/${poll.questionId}`,
    };
  });

export const Route = createFileRoute("/polls/$pollId")({
  component: PollResultPage,
  loader: async ({ params }) => {
    return getPollMeta({ data: { pollId: params.pollId } });
  },
  head: ({ loaderData }) => {
    if (!loaderData) return {};
    const groupDisplay = loaderData.groupName
      ? `${loaderData.groupName} (@${loaderData.groupHandle}@${loaderData.groupDomain})`
      : loaderData.groupHandle
        ? `@${loaderData.groupHandle}@${loaderData.groupDomain}`
        : "";
    return {
      meta: [
        { title: `${loaderData.question} — Moim` },
        {
          name: "description",
          content: `Poll by ${groupDisplay}: ${loaderData.question}`,
        },
        { property: "og:title", content: loaderData.question },
        { property: "og:description", content: `Poll by ${groupDisplay}` },
        { property: "og:type", content: "article" },
      ],
    };
  },
});

type PollOption = {
  id: string;
  label: string;
  sortOrder: number;
  count: number;
};

type PollData = {
  id: string;
  questionId: string;
  question: string;
  type: string;
  closed: boolean;
  expiresAt: string | null;
  createdAt: string;
  apUrl: string;
  options: PollOption[];
  totalVoters: number;
};

type PollResponse = {
  poll: PollData;
  group: { handle: string; name: string | null } | null;
};

function PollResultPage() {
  const { pollId } = Route.useParams();
  const meta = Route.useLoaderData();
  const [data, setData] = useState<PollResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/polls/${pollId}`)
      .then((r) => {
        if (!r.ok) throw new Error("Poll not found");
        return r.json();
      })
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [pollId]);

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl p-4">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mx-auto max-w-2xl p-4">
        <p className="text-destructive">{error || "Poll not found"}</p>
      </div>
    );
  }

  const { poll, group } = data;
  const totalVotes = poll.options.reduce((s, o) => s + o.count, 0);
  const isExpired =
    poll.expiresAt && new Date(poll.expiresAt).getTime() < Date.now();
  const isOpen = !poll.closed && !isExpired;
  const apUrl = meta?.apUrl ?? poll.apUrl;

  return (
    <div className="mx-auto max-w-2xl p-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-lg">{poll.question}</CardTitle>
            <div className="flex items-center gap-1.5 shrink-0">
              <Badge variant="secondary" className="text-xs">
                {poll.type === "single" ? "Single choice" : "Multiple choice"}
              </Badge>
              {!isOpen && (
                <Badge variant="outline" className="text-xs">
                  Closed
                </Badge>
              )}
            </div>
          </div>
          {group && (
            <p className="text-sm text-muted-foreground">
              by{" "}
              <Link
                to="/groups/$identifier"
                params={{ identifier: `@${group.handle}` }}
                className="hover:underline"
              >
                {group.name ?? `@${group.handle}`}
              </Link>
            </p>
          )}
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2.5">
            {poll.options.map((option, i) => (
              <GaugeBar
                key={option.id}
                label={option.label}
                count={option.count}
                total={totalVotes}
                colorIndex={i}
              />
            ))}
          </div>

          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              {poll.totalVoters} voter{poll.totalVoters !== 1 ? "s" : ""}
            </span>
            <span>
              {new Date(poll.createdAt).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
              {poll.expiresAt && isOpen && (
                <>
                  {" · expires "}
                  {new Date(poll.expiresAt).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </>
              )}
            </span>
          </div>

          {isOpen && apUrl && (
            <div className="border-t pt-4 flex justify-end">
              <RemoteVoteDialog apUrl={apUrl} />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
