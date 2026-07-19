import { defineEventHandler, toWebRequest } from "h3";
import type { Router } from "h3";
import { POST as createPoll } from "~/server/controllers/polls/create";
import { GET as listPolls } from "~/server/controllers/polls/list";
import { GET as pollDetail } from "~/server/controllers/polls/detail";
import { POST as castVote } from "~/server/controllers/polls/vote";
import { POST as closePoll } from "~/server/controllers/polls/close";
import { forwardGet, forwardJson } from "~/server/api/forwarding";

export function registerPollRoutes(router: Router): void {
  router.post(
    "/groups/:groupId/polls",
    defineEventHandler(async (event) => {
      const request = toWebRequest(event);
      const groupId = event.context.params?.groupId;
      if (!groupId)
        return Response.json(
          { error: "groupId is required" },
          { status: 400 },
        );

      return createPoll({
        request: await forwardJson(
          request,
          `/api/groups/${groupId}/polls`,
          "POST",
          (body) => ({
            ...body,
            groupActorId: groupId,
          }),
        ),
      });
    }),
  );

  router.get(
    "/groups/:groupId/polls",
    defineEventHandler(async (event) => {
      const request = toWebRequest(event);
      const groupId = event.context.params?.groupId;
      return listPolls({
        request: forwardGet(request, `/api/groups/${groupId}/polls`, {
          groupActorId: groupId,
        }),
      });
    }),
  );

  router.get(
    "/polls/:pollId",
    defineEventHandler(async (event) => {
      const request = toWebRequest(event);
      const pollId = event.context.params?.pollId;
      return pollDetail({
        request: forwardGet(request, `/api/polls/${pollId}`, { pollId }),
      });
    }),
  );

  router.post(
    "/polls/:pollId/vote",
    defineEventHandler(async (event) => {
      const request = toWebRequest(event);
      const pollId = event.context.params?.pollId;
      if (!pollId)
        return Response.json({ error: "pollId is required" }, { status: 400 });

      return castVote({
        request: await forwardJson(
          request,
          `/api/polls/${pollId}/vote`,
          "POST",
          (body) => ({
            ...body,
            pollId,
          }),
        ),
      });
    }),
  );

  router.post(
    "/polls/:pollId/close",
    defineEventHandler(async (event) => {
      const request = toWebRequest(event);
      const pollId = event.context.params?.pollId;
      if (!pollId)
        return Response.json({ error: "pollId is required" }, { status: 400 });

      return closePoll({
        request: await forwardJson(
          request,
          `/api/polls/${pollId}/close`,
          "POST",
          (body) => ({
            ...body,
            pollId,
          }),
        ),
      });
    }),
  );
}
