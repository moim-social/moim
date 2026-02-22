import {
  lookupObject,
  traverseCollection,
  Collection,
  Create,
  Update,
  Note,
  Article,
} from "@fedify/fedify";

/**
 * Fetch recent outbox items and return their text content.
 * Uses Fedify's lookupObject + traverseCollection for proper
 * ActivityPub collection traversal and object dereferencing.
 */
export async function fetchOutboxContent(outboxUrl: string): Promise<string[]> {
  const outbox = await lookupObject(outboxUrl);
  if (!(outbox instanceof Collection)) return [];

  const contents: string[] = [];
  let count = 0;

  for await (const item of traverseCollection(outbox, { suppressError: true })) {
    // Extract content from Create/Update activities
    if (item instanceof Create || item instanceof Update) {
      const object = await item.getObject();
      if (object instanceof Note || object instanceof Article) {
        for (const c of object.contents) {
          contents.push(c.toString());
        }
      }
    }

    // Also handle bare Note/Article (some servers inline objects directly)
    if (item instanceof Note || item instanceof Article) {
      for (const c of item.contents) {
        contents.push(c.toString());
      }
    }

    count++;
    // Only check first page worth of items
    if (count >= 50) break;
  }

  return contents;
}

export function contentContainsOtp(contents: string[], otp: string): boolean {
  return contents.some((text) => text.includes(otp));
}
