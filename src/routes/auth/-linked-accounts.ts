import { eq, and } from "drizzle-orm";
import { getSessionUser } from "~/server/auth";
import { db } from "~/server/db/client";
import { userFediverseAccounts } from "~/server/db/schema";

export const GET = async ({ request }: { request: Request }) => {
  const user = await getSessionUser(request);
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const accounts = await db
    .select({
      id: userFediverseAccounts.id,
      fediverseHandle: userFediverseAccounts.fediverseHandle,
      proxyHandle: userFediverseAccounts.proxyHandle,
      isPrimary: userFediverseAccounts.isPrimary,
      createdAt: userFediverseAccounts.createdAt,
    })
    .from(userFediverseAccounts)
    .where(eq(userFediverseAccounts.userId, user.id));

  return Response.json({ accounts });
};

export const DELETE = async ({ request }: { request: Request }) => {
  const user = await getSessionUser(request);
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    fediverseHandle?: string;
  } | null;

  if (!body?.fediverseHandle) {
    return Response.json({ error: "fediverseHandle is required" }, { status: 400 });
  }

  // Find the account to unlink
  const [account] = await db
    .select()
    .from(userFediverseAccounts)
    .where(and(
      eq(userFediverseAccounts.userId, user.id),
      eq(userFediverseAccounts.fediverseHandle, body.fediverseHandle),
    ))
    .limit(1);

  if (!account) {
    return Response.json({ error: "Account not found" }, { status: 404 });
  }

  if (account.isPrimary) {
    return Response.json({ error: "Cannot unlink primary account" }, { status: 400 });
  }

  // Check that at least one account remains
  const allAccounts = await db
    .select({ id: userFediverseAccounts.id })
    .from(userFediverseAccounts)
    .where(eq(userFediverseAccounts.userId, user.id));

  if (allAccounts.length <= 1) {
    return Response.json({ error: "Cannot unlink the only account" }, { status: 400 });
  }

  await db
    .delete(userFediverseAccounts)
    .where(eq(userFediverseAccounts.id, account.id));

  return Response.json({ ok: true });
};
