import { getObject } from "~/server/storage/s3";

export const GET = async ({ request }: { request: Request }) => {
  const url = new URL(request.url);
  // h3 strips the /maps prefix, so pathname is /{placeId}.png
  // Also handle the full path /maps/{placeId}.png for safety
  const match =
    url.pathname.match(/^\/([0-9a-f-]{36})\.png$/) ??
    url.pathname.match(/^\/maps\/([0-9a-f-]{36})\.png$/);
  if (!match) {
    return new Response("Not found", { status: 404 });
  }

  const placeId = match[1];
  const key = `maps/${placeId}.png`;

  try {
    const body = await getObject(key);
    if (!body) {
      return new Response("Not found", { status: 404 });
    }

    return new Response(body, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new Response("Internal server error", { status: 500 });
  }
};
