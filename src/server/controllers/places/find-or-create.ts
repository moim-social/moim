import { getSessionUser } from "~/server/auth";
import { assertEnabledPlaceCategory, getPlaceCategorySummary } from "~/server/places/categories";
import { findOrCreatePlace } from "~/server/places/find-or-create";

export const POST = async ({ request }: { request: Request }) => {
  const user = await getSessionUser(request);
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    latitude?: string;
    longitude?: string;
    name?: string;
    categoryId?: string;
  } | null;

  const lat = parseFloat(body?.latitude ?? "");
  const lng = parseFloat(body?.longitude ?? "");

  if (!body?.name?.trim() || Number.isNaN(lat) || Number.isNaN(lng)) {
    return Response.json(
      { error: "name, latitude, and longitude are required" },
      { status: 400 },
    );
  }

  try {
    const categoryId = body.categoryId?.trim() || null;
    if (categoryId) {
      await assertEnabledPlaceCategory(categoryId);
    }

    const place = await findOrCreatePlace({
      latitude: lat,
      longitude: lng,
      name: body.name,
      createdById: user.id,
      categoryId,
    });

    return Response.json({
      place: {
        ...place,
        category: await getPlaceCategorySummary(place.categoryId),
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to find or create place";
    const status =
      message.includes("categoryId") || message.includes("Selected category")
        ? 400
        : 500;
    return Response.json({ error: message }, { status });
  }
};
