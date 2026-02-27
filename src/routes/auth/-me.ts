import { getSessionUser } from "~/server/auth";

export const GET = async ({ request }: { request: Request }) => {
  const user = await getSessionUser(request);
  return Response.json({
    user: user
      ? {
          handle: user.fediverseHandle ?? user.handle,
          displayName: user.displayName,
        }
      : null,
  });
};
