import { getObject } from "~/server/storage/s3";

export const GET = async ({ request }: { request: Request }) => {
  const url = new URL(request.url);
  // h3 strips the /avatars prefix, so pathname is /{userId}.webp or /{userId}-composite.png
  // Also handle the full path for safety
  const match =
    url.pathname.match(
      /^\/([0-9a-f-]{36})((?:-composite)?\.(?:webp|png))$/,
    ) ??
    url.pathname.match(
      /^\/avatars\/([0-9a-f-]{36})((?:-composite)?\.(?:webp|png))$/,
    );
  if (!match) {
    return new Response("Not found", { status: 404 });
  }

  const userId = match[1];
  const suffix = match[2];
  const key = `avatars/${userId}${suffix}`;
  const contentType = suffix.endsWith(".webp") ? "image/webp" : "image/png";

  try {
    const body = await getObject(key);
    if (!body) {
      return new Response("Not found", { status: 404 });
    }

    return new Response(body, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
      },
    });
  } catch {
    return new Response("Internal server error", { status: 500 });
  }
};
