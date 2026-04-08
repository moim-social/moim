import { eq, and } from "drizzle-orm";
import sharp from "sharp";
import { db } from "~/server/db/client";
import { actors, events, groupMembers } from "~/server/db/schema";
import { getSessionUser } from "~/server/auth";
import { uploadBuffer } from "~/server/storage/s3";
import { env } from "~/server/env";

const MAX_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export const POST = async ({ request }: { request: Request }) => {
  const user = await getSessionUser(request);
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const eventId = url.searchParams.get("eventId");
  if (!eventId) {
    return Response.json({ error: "eventId is required" }, { status: 400 });
  }

  // Look up the event
  const [event] = await db
    .select({
      id: events.id,
      organizerId: events.organizerId,
      groupActorId: events.groupActorId,
    })
    .from(events)
    .where(eq(events.id, eventId))
    .limit(1);

  if (!event) {
    return Response.json({ error: "Event not found" }, { status: 404 });
  }

  // Authorization: organizer or group member
  if (event.groupActorId) {
    const [membership] = await db
      .select({ role: groupMembers.role })
      .from(groupMembers)
      .innerJoin(actors, eq(groupMembers.memberActorId, actors.id))
      .where(
        and(
          eq(groupMembers.groupActorId, event.groupActorId),
          eq(actors.userId, user.id),
          eq(actors.type, "Person"),
        ),
      )
      .limit(1);

    if (!membership) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }
  } else {
    if (event.organizerId !== user.id) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const formData = await request.formData().catch(() => null);
  if (!formData) {
    return Response.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("file");

  if (!file || !(file instanceof File)) {
    return Response.json({ error: "No file provided" }, { status: 400 });
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return Response.json(
      { error: "Only JPEG, PNG, WebP, and GIF images are allowed" },
      { status: 400 },
    );
  }

  if (file.size > MAX_SIZE) {
    return Response.json(
      { error: "File size must be under 10 MB" },
      { status: 400 },
    );
  }

  const arrayBuffer = await file.arrayBuffer();
  const inputBuffer = Buffer.from(arrayBuffer);

  // Normalize to WebP (client sends pre-cropped image from the cropper)
  const processed = await sharp(inputBuffer)
    .webp({ quality: 85 })
    .toBuffer();

  const key = `event-headers/${eventId}.webp`;
  await uploadBuffer(key, processed, "image/webp");

  const headerImageUrl = `${env.baseUrl}/event-headers/${eventId}.webp`;

  await db
    .update(events)
    .set({ headerImageUrl })
    .where(eq(events.id, eventId));

  return Response.json({ headerImageUrl }, { status: 201 });
};
