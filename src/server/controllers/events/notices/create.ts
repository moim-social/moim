import { getSessionUser } from "~/server/auth";
import { sendEventNotice, type NoticeVisibility } from "~/server/services/event-notices";

const VALID_VISIBILITIES: NoticeVisibility[] = ["unlisted", "direct"];

export const POST = async ({ request }: { request: Request }) => {
  const user = await getSessionUser(request);
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    eventId?: string;
    content?: string;
    visibility?: string;
  } | null;

  if (!body?.eventId || !body?.content?.trim()) {
    return Response.json(
      { error: "eventId and content are required" },
      { status: 400 },
    );
  }

  const visibility = (VALID_VISIBILITIES.includes(body.visibility as NoticeVisibility)
    ? body.visibility
    : "unlisted") as NoticeVisibility;

  try {
    const result = await sendEventNotice({
      eventId: body.eventId,
      content: body.content.trim(),
      userId: user.id,
      visibility,
    });

    return Response.json(
      {
        notice: {
          id: result.notice.id,
          postId: result.post.id,
        },
      },
      { status: 201 },
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to send notice";
    if (message === "Forbidden") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }
    if (message === "Event not found") {
      return Response.json({ error: "Event not found" }, { status: 404 });
    }
    return Response.json({ error: message }, { status: 500 });
  }
};
