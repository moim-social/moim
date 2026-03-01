import sharp from "sharp";
import { createHash } from "node:crypto";
import { uploadBuffer } from "~/server/storage/s3";
import { env } from "~/server/env";

let logoPngBuffer: Buffer | undefined;

async function getLogoBuffer(): Promise<Buffer> {
  if (logoPngBuffer) return logoPngBuffer;
  const res = await fetch(new URL("/logo.png", env.baseUrl));
  if (!res.ok) throw new Error(`Failed to fetch logo: ${res.status}`);
  logoPngBuffer = Buffer.from(await res.arrayBuffer());
  return logoPngBuffer;
}

export function hashIconUrl(url: string): string {
  return createHash("sha256").update(url).digest("hex");
}

export function extractIconUrl(
  raw: Record<string, unknown>,
): string | null {
  const icon = raw.icon as
    | { url?: string | { href: string }[] }
    | undefined;
  if (!icon) return null;
  if (typeof icon.url === "string") return icon.url;
  if (Array.isArray(icon.url) && icon.url[0]?.href) return icon.url[0].href;
  return null;
}

async function fetchRemoteImage(imageUrl: string): Promise<Buffer | null> {
  try {
    const response = await fetch(imageUrl, {
      headers: { Accept: "image/*" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return null;
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.startsWith("image/")) return null;
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch {
    return null;
  }
}

async function createThumbnail(
  imageBuffer: Buffer,
  size = 256,
): Promise<Buffer> {
  return sharp(imageBuffer)
    .resize(size, size, { fit: "cover", position: "centre" })
    .webp({ quality: 80 })
    .toBuffer();
}

async function createCompositeAvatar(
  avatarBuffer: Buffer,
  outputSize = 256,
  badgeSize = 72,
): Promise<Buffer> {
  const logo = await getLogoBuffer();

  const resizedAvatar = await sharp(avatarBuffer)
    .resize(outputSize, outputSize, { fit: "cover", position: "centre" })
    .png()
    .toBuffer();

  const resizedLogo = await sharp(logo)
    .resize(badgeSize, badgeSize, { fit: "contain" })
    .png()
    .toBuffer();

  return sharp(resizedAvatar)
    .composite([{ input: resizedLogo, gravity: "southeast" }])
    .png()
    .toBuffer();
}

export async function processAndStoreAvatar(
  userId: string,
  remoteIconUrl: string,
): Promise<{
  thumbnailUrl: string;
  compositeUrl: string;
  sourceHash: string;
} | null> {
  const raw = await fetchRemoteImage(remoteIconUrl);
  if (!raw) return null;

  const [thumbnail, composite] = await Promise.all([
    createThumbnail(raw),
    createCompositeAvatar(raw),
  ]);

  const thumbnailKey = `avatars/${userId}.webp`;
  const compositeKey = `avatars/${userId}-composite.png`;

  await Promise.all([
    uploadBuffer(thumbnailKey, thumbnail, "image/webp"),
    uploadBuffer(compositeKey, composite, "image/png"),
  ]);

  return {
    thumbnailUrl: `${env.baseUrl}/avatars/${userId}.webp`,
    compositeUrl: `${env.baseUrl}/avatars/${userId}-composite.png`,
    sourceHash: hashIconUrl(remoteIconUrl),
  };
}
