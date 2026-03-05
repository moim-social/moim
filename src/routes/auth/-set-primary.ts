import { and, eq } from "drizzle-orm";
import { getSessionUser } from "~/server/auth";
import { db } from "~/server/db/client";
import { userFediverseAccounts, users } from "~/server/db/schema";

export const PATCH = async ({ request }: { request: Request }) => {
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

  // Verify the handle belongs to this user
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
    return Response.json({ ok: true }); // Already primary
  }

  // In a transaction: unset all primary, set the new one
  await db.transaction(async (tx) => {
    await tx
      .update(userFediverseAccounts)
      .set({ isPrimary: false })
      .where(eq(userFediverseAccounts.userId, user.id));

    await tx
      .update(userFediverseAccounts)
      .set({ isPrimary: true })
      .where(eq(userFediverseAccounts.id, account.id));

    // Update users table for backward compat
    await tx
      .update(users)
      .set({
        fediverseHandle: body.fediverseHandle,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));
  });

  return Response.json({ ok: true });
};
