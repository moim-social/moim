import { aliasedTable, and, desc, eq, gte, isNull, or, sql } from "drizzle-orm";
import { db } from "~/server/db/client";
import { banners, events, actors, users } from "~/server/db/schema";

const TOTAL_SLOTS = 5;

export const GET = async () => {
  const now = new Date();

  // 1. Fetch active commercial banners
  const activeBanners = await db
    .select()
    .from(banners)
    .where(
      and(
        eq(banners.enabled, true),
        sql`now() >= ${banners.startsAt}`,
        or(isNull(banners.endsAt), sql`now() < ${banners.endsAt}`),
      ),
    )
    .orderBy(desc(banners.weight), banners.createdAt)
    .limit(TOTAL_SLOTS);

  const remainingSlots = TOTAL_SLOTS - activeBanners.length;
  const organizerActors = aliasedTable(actors, "organizer_actors");

  let groupEvents: Array<{
    id: string;
    title: string;
    description: string | null;
    categoryId: string | null;
    startsAt: Date;
    endsAt: Date | null;
    location: string | null;
    groupHandle: string;
    groupName: string | null;
    organizerHandle: string | null;
    organizerDisplayName: string;
    organizerActorUrl: string | null;
  }> = [];

  let personalEvents: Array<{
    id: string;
    title: string;
    description: string | null;
    categoryId: string | null;
    startsAt: Date;
    endsAt: Date | null;
    location: string | null;
    groupHandle: null;
    groupName: null;
    organizerHandle: string | null;
    organizerDisplayName: string;
    organizerActorUrl: string | null;
  }> = [];

  if (remainingSlots > 0) {
    // 2. Fetch group events (groupActorId IS NOT NULL)
    groupEvents = await db
      .select({
        id: events.id,
        title: events.title,
        description: events.description,
        categoryId: events.categoryId,
        startsAt: events.startsAt,
        endsAt: events.endsAt,
        location: events.location,
        groupHandle: actors.handle,
        groupName: actors.name,
        organizerHandle: users.fediverseHandle,
        organizerDisplayName: users.displayName,
        organizerActorUrl: organizerActors.url,
      })
      .from(events)
      .innerJoin(actors, eq(events.groupActorId, actors.id))
      .innerJoin(users, eq(events.organizerId, users.id))
      .leftJoin(
        organizerActors,
        and(
          eq(organizerActors.userId, users.id),
          eq(organizerActors.isLocal, false),
        ),
      )
      .where(gte(events.startsAt, now))
      .orderBy(events.startsAt)
      .limit(remainingSlots);

    const personalSlots = remainingSlots - groupEvents.length;

    if (personalSlots > 0) {
      // 3. Fetch personal events (groupActorId IS NULL)
      personalEvents = await db
        .select({
          id: events.id,
          title: events.title,
          description: events.description,
          categoryId: events.categoryId,
          startsAt: events.startsAt,
          endsAt: events.endsAt,
          location: events.location,
          groupHandle: sql<null>`NULL`.as("group_handle"),
          groupName: sql<null>`NULL`.as("group_name"),
          organizerHandle: users.fediverseHandle,
          organizerDisplayName: users.displayName,
          organizerActorUrl: organizerActors.url,
        })
        .from(events)
        .innerJoin(users, eq(events.organizerId, users.id))
        .leftJoin(
          organizerActors,
          and(
            eq(organizerActors.userId, users.id),
            eq(organizerActors.isLocal, false),
          ),
        )
        .where(and(gte(events.startsAt, now), isNull(events.groupActorId)))
        .orderBy(events.startsAt)
        .limit(personalSlots);
    }
  }

  // 4. Increment impression counts for returned banners (fire-and-forget)
  if (activeBanners.length > 0) {
    const bannerIds = activeBanners.map((b) => b.id);
    db.update(banners)
      .set({ impressionCount: sql`${banners.impressionCount} + 1` })
      .where(sql`${banners.id} = ANY(ARRAY[${sql.join(bannerIds.map((id) => sql`${id}::uuid`), sql`, `)}])`)
      .execute()
      .catch(() => {});
  }

  // 5. Compose unified slide list
  const slides = [
    ...activeBanners.map((b) => ({
      type: "banner" as const,
      id: b.id,
      title: b.title,
      imageUrl: b.imageUrl,
      linkUrl: b.linkUrl,
      altText: b.altText,
    })),
    ...groupEvents.map((e) => ({ type: "event" as const, ...e })),
    ...personalEvents.map((e) => ({ type: "event" as const, ...e })),
  ];

  return Response.json({ slides });
};
