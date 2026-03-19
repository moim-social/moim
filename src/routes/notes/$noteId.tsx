import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { zodValidator } from "@tanstack/zod-adapter";
import { useEffect, useState } from "react";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "~/server/db/client";
import { posts, actors } from "~/server/db/schema";

const getNoteMeta = createServerFn({ method: "GET" })
  .inputValidator(zodValidator(z.object({ noteId: z.string() })))
  .handler(async ({ data }) => {
    const [note] = await db
      .select({
        content: posts.content,
        actorHandle: actors.handle,
        actorName: actors.name,
        actorDomain: actors.domain,
      })
      .from(posts)
      .innerJoin(actors, eq(posts.actorId, actors.id))
      .where(eq(posts.id, data.noteId))
      .limit(1);
    return note ?? null;
  });

export const Route = createFileRoute("/notes/$noteId")({
  component: NoteDetailPage,
  loader: async ({ params }) => {
    return getNoteMeta({ data: { noteId: params.noteId } });
  },
  head: ({ loaderData }) => {
    if (!loaderData) return {};
    const plainText = loaderData.content.replace(/<[^>]*>/g, "").slice(0, 200);
    const author = loaderData.actorName
      ? `${loaderData.actorName} (@${loaderData.actorHandle}@${loaderData.actorDomain})`
      : `@${loaderData.actorHandle}@${loaderData.actorDomain}`;
    return {
      meta: [
        { title: `${author}: ${plainText.slice(0, 60)} — Moim` },
        { name: "description", content: plainText },
        { property: "og:title", content: author },
        { property: "og:description", content: plainText },
        { property: "og:type", content: "article" },
        { property: "fediverse:creator", content: `@${loaderData.actorHandle}@${loaderData.actorDomain}` },
      ],
    };
  },
});

type NoteData = {
  note: {
    id: string;
    content: string;
    published: string;
    actorHandle: string;
    actorName: string | null;
  };
};

function NoteDetailPage() {
  const { noteId } = Route.useParams();
  const [data, setData] = useState<NoteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/notes/${noteId}`)
      .then((r) => {
        if (!r.ok) throw new Error("Note not found");
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
  }, [noteId]);

  if (loading) {
    return <p className="text-muted-foreground">Loading...</p>;
  }

  if (error || !data) {
    return <p className="text-destructive">{error || "Note not found"}</p>;
  }

  const { note } = data;
  const published = new Date(note.published);
  const dateStr = published.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const timeStr = published.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="mx-auto max-w-2xl">
      {/* Author header */}
      <div className="flex items-center gap-3 pb-5 border-b-2 border-foreground">
        <div className="size-10 rounded-full bg-muted text-muted-foreground flex items-center justify-center text-sm font-semibold shrink-0">
          {(note.actorName ?? note.actorHandle).charAt(0).toUpperCase()}
        </div>
        <div>
          <p className="text-[15px] font-bold tracking-tight">
            {note.actorName ?? note.actorHandle}
          </p>
          <p className="text-[12px] text-[#888]">
            @{note.actorHandle}
          </p>
        </div>
        <span className="ml-auto text-[11px] text-[#999]">
          {dateStr} · {timeStr}
        </span>
      </div>

      {/* Content */}
      <div className="mt-6">
        <div
          className="prose prose-sm max-w-none text-[14px] text-[#333] leading-relaxed"
          dangerouslySetInnerHTML={{ __html: note.content }}
        />
      </div>
    </div>
  );
}
