import { getSessionUser } from "~/server/auth";
import { checkDashboardAccess } from "~/server/services/event-dashboard";
import { listNoticesByEvent } from "~/server/repositories/event-notices";

export const GET = async ({ request }: { request: Request }) => {
  const url = new URL(request.url);
  const eventId = url.searchParams.get("eventId");
  if (!eventId) {
    return Response.json({ error: "eventId is required" }, { status: 400 });
  }

  // Public access: no auth required, returns notices for any published event
  const isPublic = url.searchParams.get("public") === "1";

  if (!isPublic) {
    const user = await getSessionUser(request);
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    const access = await checkDashboardAccess(eventId, user.id);
    if (!access.allowed) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const limit = Math.min(
    parseInt(url.searchParams.get("limit") ?? "20", 10),
    100,
  );
  const offset = parseInt(url.searchParams.get("offset") ?? "0", 10);

  const result = await listNoticesByEvent(eventId, { limit, offset });
  return Response.json(result);
};
