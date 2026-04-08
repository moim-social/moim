import { eq, sql } from "drizzle-orm";
import { db } from "~/server/db/client";
import { banners } from "~/server/db/schema";

export const POST = async ({ request }: { request: Request }) => {
  const body = await request.json().catch(() => null);
  if (!body?.bannerId) {
    return Response.json({ error: "bannerId required" }, { status: 400 });
  }

  await db
    .update(banners)
    .set({ clickCount: sql`${banners.clickCount} + 1` })
    .where(eq(banners.id, body.bannerId));

  return Response.json({ ok: true });
};
