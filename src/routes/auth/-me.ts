import { getSessionUser } from "~/server/auth";

export const GET = async ({ request }: { request: Request }) => {
  const user = await getSessionUser(request);
  return Response.json({
    user: user
      ? {
          handle: user.handle,
          fediverseHandle: user.fediverseHandle,
          displayName: user.displayName,
        }
      : null,
  });
};
