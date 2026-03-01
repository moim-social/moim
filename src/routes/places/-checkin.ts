import { eq } from "drizzle-orm";
import { db } from "~/server/db/client";
import { checkins, places } from "~/server/db/schema";
import { getSessionUser } from "~/server/auth";
import { postCheckin } from "~/server/fediverse/checkin";
import { findOrCreatePlace } from "~/server/places/find-or-create";
import { generateAndUploadMapSnapshot } from "~/server/places/map-snapshot";

export const POST = async ({ request }: { request: Request }) => {
  const user = await getSessionUser(request);
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    latitude?: string;
    longitude?: string;
    name?: string;
    note?: string;
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
    const place = await findOrCreatePlace({
      latitude: lat,
      longitude: lng,
      name: body.name,
      createdById: user.id,
    });

    // Ensure the place has a map image before federating
    if (!place.latitude || !place.longitude) {
      // No coordinates — skip map generation
    } else {
      const [placeRow] = await db
        .select({ mapImageUrl: places.mapImageUrl })
        .from(places)
        .where(eq(places.id, place.id))
        .limit(1);

      if (!placeRow?.mapImageUrl) {
        try {
          await generateAndUploadMapSnapshot(
            place.id,
            parseFloat(place.latitude),
            parseFloat(place.longitude),
          );
        } catch (err) {
          console.error("Failed to generate map snapshot:", err);
        }
      }
    }

    const [checkin] = await db
      .insert(checkins)
      .values({
        userId: user.id,
        placeId: place.id,
        note: body.note?.trim() || null,
      })
      .returning();

    // Federate the check-in as a Note from the proxy actor
    try {
      await postCheckin(user.id, checkin, place);
    } catch (err) {
      console.error("Failed to federate check-in:", err);
    }

    return Response.json({
      checkin: { id: checkin.id, placeId: checkin.placeId, note: checkin.note },
      place: { id: place.id, name: place.name, created: place.created },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to check in";
    return Response.json({ error: message }, { status: 500 });
  }
};
