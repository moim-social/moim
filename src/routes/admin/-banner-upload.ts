import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { requireAdmin } from "~/server/admin";
import { uploadBuffer } from "~/server/storage/s3";
import { env } from "~/server/env";

const MAX_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export const POST = async ({ request }: { request: Request }) => {
  await requireAdmin(request);

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("multipart/form-data")) {
    return Response.json(
      { error: "Expected multipart/form-data" },
      { status: 400 },
    );
  }

  const formData = await request.formData();
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

  // Validate landscape orientation
  const metadata = await sharp(inputBuffer).metadata();
  if (!metadata.width || !metadata.height || metadata.height > metadata.width) {
    return Response.json(
      { error: "Image must be landscape (wider than tall)" },
      { status: 400 },
    );
  }

  // Resize to 2048x680 (3:1 aspect, 2x for retina) and convert to WebP
  // For very wide images, center vertically instead of cropping from centre
  const aspectRatio = metadata.width / metadata.height;
  const fit = aspectRatio > 4 ? "contain" as const : "cover" as const;
  const processed = await sharp(inputBuffer)
    .resize(2048, 680, { fit, position: "centre", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .webp({ quality: 85 })
    .toBuffer();

  const id = randomUUID();
  const key = `banners/${id}.webp`;

  await uploadBuffer(key, processed, "image/webp");

  const imageUrl = `${env.baseUrl}/banners/${id}.webp`;

  return Response.json({ imageUrl }, { status: 201 });
};
