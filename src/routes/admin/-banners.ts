import { desc, eq } from "drizzle-orm";
import { db } from "~/server/db/client";
import { banners } from "~/server/db/schema";
import { requireAdmin } from "~/server/admin";

export const GET = async ({ request }: { request: Request }) => {
  await requireAdmin(request);
  const rows = await db
    .select()
    .from(banners)
    .orderBy(desc(banners.weight), banners.createdAt);
  return Response.json({ banners: rows });
};

export const POST = async ({ request }: { request: Request }) => {
  await requireAdmin(request);
  const body = await request.json();

  const { title, imageUrl, linkUrl, altText, requester, weight, enabled, startsAt, endsAt } = body;
  if (!title || !imageUrl || !linkUrl || !startsAt) {
    return Response.json(
      { error: "title, imageUrl, linkUrl, and startsAt are required" },
      { status: 400 },
    );
  }

  const [row] = await db
    .insert(banners)
    .values({
      title,
      imageUrl,
      linkUrl,
      altText: altText ?? null,
      requester: requester ?? null,
      weight: weight ?? 0,
      enabled: enabled ?? false,
      startsAt: new Date(startsAt),
      endsAt: endsAt ? new Date(endsAt) : null,
    })
    .returning();

  return Response.json({ banner: row }, { status: 201 });
};

export const PUT = async ({ request }: { request: Request }) => {
  await requireAdmin(request);
  const body = await request.json();

  if (!body.id) {
    return Response.json({ error: "id is required" }, { status: 400 });
  }

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (body.title !== undefined) updates.title = body.title;
  if (body.imageUrl !== undefined) updates.imageUrl = body.imageUrl;
  if (body.linkUrl !== undefined) updates.linkUrl = body.linkUrl;
  if (body.altText !== undefined) updates.altText = body.altText;
  if (body.requester !== undefined) updates.requester = body.requester;
  if (body.weight !== undefined) updates.weight = body.weight;
  if (body.enabled !== undefined) updates.enabled = body.enabled;
  if (body.startsAt !== undefined) updates.startsAt = new Date(body.startsAt);
  if (body.endsAt !== undefined) updates.endsAt = body.endsAt ? new Date(body.endsAt) : null;

  const [row] = await db
    .update(banners)
    .set(updates)
    .where(eq(banners.id, body.id))
    .returning();

  if (!row) {
    return Response.json({ error: "Banner not found" }, { status: 404 });
  }

  return Response.json({ banner: row });
};

export const PATCH = async ({ request }: { request: Request }) => {
  await requireAdmin(request);
  const body = await request.json();

  if (!body.id || body.enabled === undefined) {
    return Response.json({ error: "id and enabled are required" }, { status: 400 });
  }

  const [row] = await db
    .update(banners)
    .set({ enabled: body.enabled, updatedAt: new Date() })
    .where(eq(banners.id, body.id))
    .returning();

  if (!row) {
    return Response.json({ error: "Banner not found" }, { status: 404 });
  }

  return Response.json({ banner: row });
};

export const DELETE = async ({ request }: { request: Request }) => {
  await requireAdmin(request);
  const url = new URL(request.url);
  const id = url.searchParams.get("id");

  if (!id) {
    return Response.json({ error: "id query param is required" }, { status: 400 });
  }

  const [row] = await db
    .delete(banners)
    .where(eq(banners.id, id))
    .returning();

  if (!row) {
    return Response.json({ error: "Banner not found" }, { status: 404 });
  }

  return Response.json({ ok: true });
};
