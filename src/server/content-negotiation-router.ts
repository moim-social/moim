import { fromWebHandler } from "h3";
import type { EventHandler } from "h3";
import { Note, Place } from "@fedify/vocab";
import { respondWithObjectIfAcceptable } from "@fedify/fedify";
import { federation } from "~/server/fediverse/federation";
import { GET as groupFeed } from "~/server/controllers/groups/feed";
import { GET as icsFeed } from "~/server/controllers/events/ics";
import { GET as personalIcsFeed } from "~/server/controllers/events/personal-ics";
import { forwardGet } from "~/server/api/forwarding";
import { findGroupByHandle } from "~/server/repositories/actors";
import {
  findPollIdByQuestionId,
  findQuestionIdByPollId,
} from "~/server/repositories/polls";

// TODO(#131): rewrite this imperative regex dispatch into a declarative
// content-negotiation resolver list. This file only relocates the existing
// logic verbatim out of server-entry.ts.
export function createContentNegotiationHandler(
  startFetch: (request: Request) => Response | Promise<Response>,
): EventHandler {
  return fromWebHandler(async (request) => {
    const url = new URL(request.url);

    // RSS feed for groups
    const feedMatch = url.pathname.match(/^\/groups\/@([^/]+)\/feed\.xml$/);
    if (feedMatch) {
      const handle = decodeURIComponent(feedMatch[1]);
      return groupFeed({
        request: forwardGet(request, "/groups/feed", { handle }),
      });
    }

    // ICS calendar feed for groups
    const groupIcsMatch = url.pathname.match(
      /^\/groups\/@([^/]+)\/events\.ics$/,
    );
    if (groupIcsMatch) {
      const handle = decodeURIComponent(groupIcsMatch[1]);
      const group = await findGroupByHandle(handle);
      if (group) {
        const calendarName = group.name ?? `@${group.handle}`;
        return icsFeed({
          request: forwardGet(request, "/events/ics", {
            groupActorId: group.id,
            calendarName,
          }),
        });
      }
      return new Response("Group not found", { status: 404 });
    }
    // ICS calendar feed for categories (optionally filtered by country)
    const categoryIcsMatch = url.pathname.match(
      /^\/categories\/([^/]+)(?:\/countries\/([A-Z]{2}))?\/events\.ics$/,
    );
    if (categoryIcsMatch) {
      const slug = decodeURIComponent(categoryIcsMatch[1]);
      const country = categoryIcsMatch[2] ?? undefined;
      const calendarName = country
        ? `${slug} (${country}) — Moim`
        : `${slug} — Moim`;
      return icsFeed({
        request: forwardGet(request, "/events/ics", {
          categoryId: slug,
          country,
          calendarName,
        }),
      });
    }

    // Personal RSVP calendar feed
    if (url.pathname === "/calendar.ics") {
      return personalIcsFeed({ request });
    }

    // Content negotiation: serve AP object directly for /notes/{uuid} and /places/{uuid}
    const noteMatch = url.pathname.match(/^\/notes\/([0-9a-f-]{36})$/);
    if (noteMatch) {
      const ctx = federation.createContext(request, undefined);
      const note = await ctx.getObject(Note, { noteId: noteMatch[1] });
      if (note) {
        const response = await respondWithObjectIfAcceptable(note, request);
        if (response) return response;
      }
    }
    const placeMatch = url.pathname.match(/^\/places\/([0-9a-f-]{36})$/);
    if (placeMatch) {
      const ctx = federation.createContext(request, undefined);
      const place = await ctx.getObject(Place, { placeId: placeMatch[1] });
      if (place) {
        const response = await respondWithObjectIfAcceptable(place, request);
        if (response) return response;
      }
    }
    // /ap/notes/{noteId} + browser → redirect to /notes/{noteId}
    const apNoteMatch = url.pathname.match(/^\/ap\/notes\/([0-9a-f-]{36})$/);
    if (apNoteMatch) {
      const accept = request.headers.get("Accept") ?? "";
      const isAP =
        accept.includes("application/activity+json") ||
        accept.includes("application/ld+json");
      if (!isAP) {
        return Response.redirect(
          new URL(`/notes/${apNoteMatch[1]}`, url.origin),
          302,
        );
      }
    }
    // /ap/questions/{questionId} + browser → redirect to /polls/{pollId}
    const apQuestionMatch = url.pathname.match(
      /^\/ap\/questions\/([0-9a-f-]{36})$/,
    );
    if (apQuestionMatch) {
      const accept = request.headers.get("Accept") ?? "";
      const isAP =
        accept.includes("application/activity+json") ||
        accept.includes("application/ld+json");
      if (!isAP) {
        const pollId = await findPollIdByQuestionId(apQuestionMatch[1]);
        if (pollId) {
          return Response.redirect(
            new URL(`/polls/${pollId}`, url.origin),
            302,
          );
        }
      }
    }
    // /polls/{pollId} + AP Accept → redirect to /ap/questions/{questionId}
    const pollMatch = url.pathname.match(/^\/polls\/([0-9a-f-]{36})$/);
    if (pollMatch) {
      const accept = request.headers.get("Accept") ?? "";
      const isAP =
        accept.includes("application/activity+json") ||
        accept.includes("application/ld+json");
      if (isAP) {
        const questionId = await findQuestionIdByPollId(pollMatch[1]);
        if (questionId) {
          return Response.redirect(
            new URL(`/ap/questions/${questionId}`, url.origin),
            302,
          );
        }
      }
    }
    return startFetch(request);
  });
}
