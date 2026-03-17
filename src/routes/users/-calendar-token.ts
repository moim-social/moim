import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "~/server/db/client";
import { users } from "~/server/db/schema";
import { getSessionUser } from "~/server/auth";

export const POST = async ({ request }: { request: Request }) => {
  const user = await getSessionUser(request);
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = randomBytes(32).toString("hex");
  await db
    .update(users)
    .set({ calendarToken: token, updatedAt: new Date() })
    .where(eq(users.id, user.id));

  return Response.json({ calendarToken: token });
};

export const DELETE = async ({ request }: { request: Request }) => {
  const user = await getSessionUser(request);
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  await db
    .update(users)
    .set({ calendarToken: null, updatedAt: new Date() })
    .where(eq(users.id, user.id));

  return Response.json({ calendarToken: null });
};
