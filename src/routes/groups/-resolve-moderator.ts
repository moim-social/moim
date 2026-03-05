import { getSessionUser } from "~/server/auth";
import { resolveActorUrl, fetchActorProfile } from "~/server/fediverse/resolve";

export const POST = async ({ request }: { request: Request }) => {
  const user = await getSessionUser(request);
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    handle?: string;
  } | null;

  if (!body?.handle) {
    return Response.json({ error: "handle is required" }, { status: 400 });
  }

  const handle = body.handle.startsWith("@") ? body.handle.slice(1) : body.handle;

  try {
    const actorUrl = await resolveActorUrl(handle);
    const data = await fetchActorProfile(actorUrl);

    return Response.json({
      actor: {
        handle,
        name: data.name ?? data.preferredUsername ?? handle,
        actorUrl: data.id,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to resolve handle";
    return Response.json({ error: message }, { status: 422 });
  }
};
