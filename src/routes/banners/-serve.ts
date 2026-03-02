import { getObject } from "~/server/storage/s3";

export const GET = async ({ request }: { request: Request }) => {
  const url = new URL(request.url);
  const match =
    url.pathname.match(/^\/([0-9a-f-]{36})\.webp$/) ??
    url.pathname.match(/^\/banners\/([0-9a-f-]{36})\.webp$/);

  if (!match) {
    return new Response("Not found", { status: 404 });
  }

  const id = match[1];
  const key = `banners/${id}.webp`;

  try {
    const body = await getObject(key);
    if (!body) {
      return new Response("Not found", { status: 404 });
    }

    return new Response(body, {
      headers: {
        "Content-Type": "image/webp",
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
      },
    });
  } catch {
    return new Response("Internal server error", { status: 500 });
  }
};
