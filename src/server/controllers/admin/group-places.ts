import { eq, and } from "drizzle-orm";
import { db } from "~/server/db/client";
import { actors, groupPlaces, places, placeCategories } from "~/server/db/schema";
import { requireAdmin } from "~/server/admin";
import { logPlaceAction } from "~/server/places/audit";

export const GET = async ({ request }: { request: Request }) => {
  await requireAdmin(request);
  const url = new URL(request.url);
  const groupActorId = url.searchParams.get("groupActorId")?.trim() || null;

  if (!groupActorId) {
    // List all groups (so admin can select any group to assign places)
    const groups = await db
      .select({
        id: actors.id,
        handle: actors.handle,
        name: actors.name,
      })
      .from(actors)
      .where(eq(actors.type, "Group"));

    return Response.json({ groups });
  }

  // List places assigned to a specific group
  const rows = await db
    .select({
      id: groupPlaces.id,
      placeId: places.id,
      placeName: places.name,
      placeAddress: places.address,
      assignedAt: groupPlaces.assignedAt,
      categorySlug: placeCategories.slug,
      categoryLabel: placeCategories.label,
      categoryEmoji: placeCategories.emoji,
    })
    .from(groupPlaces)
    .innerJoin(places, eq(groupPlaces.placeId, places.id))
    .leftJoin(placeCategories, eq(places.categoryId, placeCategories.slug))
    .where(eq(groupPlaces.groupActorId, groupActorId));

  return Response.json({
    places: rows.map((row) => ({
      id: row.placeId,
      name: row.placeName,
      address: row.placeAddress,
      assignedAt: row.assignedAt,
      category: row.categorySlug
        ? { slug: row.categorySlug, label: row.categoryLabel, emoji: row.categoryEmoji }
        : null,
    })),
  });
};

export const POST = async ({ request }: { request: Request }) => {
  const admin = await requireAdmin(request);
  const body = (await request.json().catch(() => null)) as {
    groupActorId?: string;
    placeId?: string;
  } | null;

  if (!body?.groupActorId?.trim() || !body?.placeId?.trim()) {
    return Response.json({ error: "groupActorId and placeId are required" }, { status: 400 });
  }

  // Verify group exists
  const [group] = await db
    .select({ id: actors.id })
    .from(actors)
    .where(and(eq(actors.id, body.groupActorId), eq(actors.type, "Group")))
    .limit(1);
  if (!group) {
    return Response.json({ error: "Group not found" }, { status: 404 });
  }

  // Verify place exists
  const [place] = await db
    .select({ id: places.id })
    .from(places)
    .where(eq(places.id, body.placeId))
    .limit(1);
  if (!place) {
    return Response.json({ error: "Place not found" }, { status: 404 });
  }

  // Check if already assigned
  const [existing] = await db
    .select({ id: groupPlaces.id })
    .from(groupPlaces)
    .where(and(eq(groupPlaces.groupActorId, body.groupActorId), eq(groupPlaces.placeId, body.placeId)))
    .limit(1);
  if (existing) {
    return Response.json({ error: "Place already assigned to this group" }, { status: 409 });
  }

  const [row] = await db
    .insert(groupPlaces)
    .values({
      groupActorId: body.groupActorId,
      placeId: body.placeId,
      assignedByUserId: admin.id,
    })
    .returning();

  await logPlaceAction({
    placeId: body.placeId,
    groupActorId: body.groupActorId,
    userId: admin.id,
    action: "assign",
  });

  return Response.json({ groupPlace: row }, { status: 201 });
};

export const DELETE = async ({ request }: { request: Request }) => {
  const admin = await requireAdmin(request);
  const body = (await request.json().catch(() => null)) as {
    groupActorId?: string;
    placeId?: string;
  } | null;

  if (!body?.groupActorId?.trim() || !body?.placeId?.trim()) {
    return Response.json({ error: "groupActorId and placeId are required" }, { status: 400 });
  }

  const [existing] = await db
    .select({ id: groupPlaces.id })
    .from(groupPlaces)
    .where(and(eq(groupPlaces.groupActorId, body.groupActorId), eq(groupPlaces.placeId, body.placeId)))
    .limit(1);

  if (!existing) {
    return Response.json({ error: "Assignment not found" }, { status: 404 });
  }

  await db
    .delete(groupPlaces)
    .where(eq(groupPlaces.id, existing.id));

  await logPlaceAction({
    placeId: body.placeId,
    groupActorId: body.groupActorId,
    userId: admin.id,
    action: "unassign",
  });

  return Response.json({ ok: true });
};
