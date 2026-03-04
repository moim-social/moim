import { eq, and } from "drizzle-orm";
import { db } from "~/server/db/client";
import { groupPlaces, places, placeCategories } from "~/server/db/schema";
import { requireGroupMember } from "~/server/group-auth";
import { getPlaceCategories } from "~/server/places/categories";
import { logPlaceAction } from "~/server/places/audit";

function normalizeOptionalString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized ? normalized : null;
}

export const GET = async ({ request }: { request: Request }) => {
  const url = new URL(request.url);
  const groupActorId = url.searchParams.get("groupActorId")?.trim();

  if (!groupActorId) {
    return Response.json({ error: "groupActorId is required" }, { status: 400 });
  }

  const rows = await db
    .select({
      id: places.id,
      name: places.name,
      address: places.address,
      latitude: places.latitude,
      longitude: places.longitude,
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
      id: row.id,
      name: row.name,
      address: row.address,
      latitude: row.latitude,
      longitude: row.longitude,
      category: row.categorySlug
        ? { slug: row.categorySlug, label: row.categoryLabel, emoji: row.categoryEmoji }
        : null,
    })),
  });
};

export const PATCH = async ({ request }: { request: Request }) => {
  const body = (await request.json().catch(() => null)) as {
    groupActorId?: string;
    placeId?: string;
    categoryId?: string;
    description?: string;
    address?: string;
    website?: string;
  } | null;

  if (!body?.groupActorId?.trim() || !body?.placeId?.trim()) {
    return Response.json({ error: "groupActorId and placeId are required" }, { status: 400 });
  }

  const { user } = await requireGroupMember(request, body.groupActorId);

  // Verify place is assigned to this group
  const [assignment] = await db
    .select({ id: groupPlaces.id })
    .from(groupPlaces)
    .where(and(eq(groupPlaces.groupActorId, body.groupActorId), eq(groupPlaces.placeId, body.placeId)))
    .limit(1);

  if (!assignment) {
    return Response.json({ error: "Place is not assigned to this group" }, { status: 403 });
  }

  // Get current place for audit diff
  const [currentPlace] = await db
    .select()
    .from(places)
    .where(eq(places.id, body.placeId))
    .limit(1);

  if (!currentPlace) {
    return Response.json({ error: "Place not found" }, { status: 404 });
  }

  const updates: Partial<typeof places.$inferInsert> = {
    updatedAt: new Date(),
  };
  const changes: Record<string, { old: unknown; new: unknown }> = {};

  if ("categoryId" in body) {
    const categoryId = normalizeOptionalString(body.categoryId);
    if (categoryId) {
      const rows = await getPlaceCategories(true);
      if (!rows.some((row) => row.slug === categoryId)) {
        return Response.json({ error: "Category not found" }, { status: 400 });
      }
      updates.categoryId = categoryId;
    } else {
      updates.categoryId = null;
    }
    changes.categoryId = { old: currentPlace.categoryId, new: updates.categoryId ?? null };
  }
  if ("description" in body) {
    updates.description = normalizeOptionalString(body.description);
    changes.description = { old: currentPlace.description, new: updates.description ?? null };
  }
  if ("address" in body) {
    updates.address = normalizeOptionalString(body.address);
    changes.address = { old: currentPlace.address, new: updates.address ?? null };
  }
  if ("website" in body) {
    updates.website = normalizeOptionalString(body.website);
    changes.website = { old: currentPlace.website, new: updates.website ?? null };
  }

  const [updatedPlace] = await db
    .update(places)
    .set(updates)
    .where(eq(places.id, body.placeId))
    .returning();

  await logPlaceAction({
    placeId: body.placeId,
    groupActorId: body.groupActorId,
    userId: user.id,
    action: "update",
    changes: Object.keys(changes).length > 0 ? changes : null,
  });

  return Response.json({ place: updatedPlace });
};
