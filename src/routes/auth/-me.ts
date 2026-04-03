import { createHash } from "node:crypto";
import { getSessionUser } from "~/server/auth";
import { isAdmin } from "~/server/admin";

function hashIdentity(handle: string): string {
  return createHash("sha256").update(handle).digest("hex");
}

export const GET = async ({ request }: { request: Request }) => {
  const user = await getSessionUser(request);
  const identity = user ? (user.fediverseHandle ?? user.handle) : null;
  return Response.json({
    user: user
      ? {
          handle: identity!,
          displayName: user.displayName,
          avatarUrl: user.avatarUrl,
          isAdmin: isAdmin(user),
          posthogId: hashIdentity(identity!),
        }
      : null,
  });
};
