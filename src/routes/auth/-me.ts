import { getSessionUser } from "~/server/auth";
import { isAdmin } from "~/server/admin";

export const GET = async ({ request }: { request: Request }) => {
  const user = await getSessionUser(request);
  return Response.json({
    user: user
      ? {
          handle: user.fediverseHandle ?? user.handle,
          displayName: user.displayName,
          avatarUrl: user.avatarUrl,
          isAdmin: isAdmin(user),
        }
      : null,
  });
};
