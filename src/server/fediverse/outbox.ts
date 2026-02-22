export type OutboxItem = {
  id?: string;
  type?: string;
  content?: string;
  contentMap?: Record<string, string>;
  object?: { content?: string; contentMap?: Record<string, string> };
};

function extractContent(item: OutboxItem): string[] {
  const contents: string[] = [];
  if (item.content) contents.push(item.content);
  if (item.contentMap) contents.push(...Object.values(item.contentMap));
  if (item.object?.content) contents.push(item.object.content);
  if (item.object?.contentMap) contents.push(...Object.values(item.object.contentMap));
  return contents;
}

export async function fetchOutboxItems(outboxUrl: string): Promise<OutboxItem[]> {
  const response = await fetch(outboxUrl, {
    headers: {
      Accept: "application/activity+json",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch outbox: ${response.status}`);
  }

  const data = (await response.json()) as {
    orderedItems?: OutboxItem[];
    items?: OutboxItem[];
    first?: string | { id?: string };
  };

  // If items exist at root level, return them directly
  if (data.orderedItems?.length || data.items?.length) {
    return data.orderedItems ?? data.items ?? [];
  }

  // Follow pagination: Mastodon puts items on the `first` page
  if (data.first) {
    const firstUrl = typeof data.first === "string"
      ? data.first
      : data.first.id;
    if (!firstUrl) return [];

    const pageResponse = await fetch(firstUrl, {
      headers: { Accept: "application/activity+json" },
    });
    if (!pageResponse.ok) return [];

    const pageData = (await pageResponse.json()) as {
      orderedItems?: OutboxItem[];
      items?: OutboxItem[];
    };
    return pageData.orderedItems ?? pageData.items ?? [];
  }

  return [];
}

export function outboxContainsOtp(items: OutboxItem[], otp: string): boolean {
  return items.some((item) =>
    extractContent(item).some((text) => text.includes(otp))
  );
}
