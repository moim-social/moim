import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { eq } from "drizzle-orm";
import { db } from "../db/client";
import { eventTicketingSettings } from "../db/schema";

export type EventTicketingSetting = InferSelectModel<typeof eventTicketingSettings>;
export type NewEventTicketingSetting = InferInsertModel<typeof eventTicketingSettings>;

export async function findByEventId(eventId: string): Promise<EventTicketingSetting | undefined> {
  const [row] = await db
    .select()
    .from(eventTicketingSettings)
    .where(eq(eventTicketingSettings.eventId, eventId))
    .limit(1);
  return row;
}

export async function upsert(values: NewEventTicketingSetting): Promise<EventTicketingSetting> {
  const [row] = await db
    .insert(eventTicketingSettings)
    .values(values)
    .onConflictDoUpdate({
      target: eventTicketingSettings.eventId,
      set: {
        mode: values.mode,
        provider: values.provider,
        providerAccountId: values.providerAccountId,
        currency: values.currency,
        enabled: values.enabled,
        legacy: values.legacy,
        updatedAt: new Date(),
      },
    })
    .returning();
  return row;
}
