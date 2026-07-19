export function buildForwardUrl(
  request: Request,
  pathname: string,
  query: Record<string, string | undefined> = {},
): URL {
  const url = new URL(request.url);
  const next = new URL(pathname, url.origin);
  for (const [key, value] of url.searchParams.entries()) {
    next.searchParams.set(key, value);
  }
  for (const [key, value] of Object.entries(query)) {
    if (value == null) next.searchParams.delete(key);
    else next.searchParams.set(key, value);
  }
  return next;
}

export function forwardGet(
  request: Request,
  pathname: string,
  query: Record<string, string | undefined> = {},
): Request {
  return new Request(buildForwardUrl(request, pathname, query), {
    method: "GET",
    headers: new Headers(request.headers),
  });
}

export async function forwardJson(
  request: Request,
  pathname: string,
  method: string,
  mutate: (body: Record<string, unknown> | null) => Record<string, unknown>,
): Promise<Request> {
  const body = (await request.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  const headers = new Headers(request.headers);
  headers.set("content-type", "application/json");
  return new Request(buildForwardUrl(request, pathname), {
    method,
    headers,
    body: JSON.stringify(mutate(body)),
  });
}

export async function forwardFormData(
  request: Request,
  pathname: string,
  method: string,
  mutate: (formData: FormData) => Promise<FormData> | FormData,
): Promise<Request> {
  const formData = await request.formData();
  const nextFormData = await mutate(formData);
  const headers = new Headers(request.headers);
  headers.delete("content-type");
  return new Request(buildForwardUrl(request, pathname), {
    method,
    headers,
    body: nextFormData,
  });
}
