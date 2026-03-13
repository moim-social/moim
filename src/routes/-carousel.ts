import { aliasedTable, and, desc, eq, gte, isNull, or, sql } from "drizzle-orm";
import { db } from "~/server/db/client";
import { banners, events, actors, users, userFediverseAccounts } from "~/server/db/schema";
import { computeH3Index, isWithinReach } from "~/server/geo/h3";

const TOTAL_SLOTS = 5;

export const GET = async ({ request }: { request: Request }) => {
  const now = new Date();
  const url = new URL(request.url);
  const lat = parseFloat(url.searchParams.get("lat") ?? "");
  const lng = parseFloat(url.searchParams.get("lng") ?? "");
  const hasUserLocation = !Number.isNaN(lat) && !Number.isNaN(lng);
  const userCell = hasUserLocation ? computeH3Index(lat, lng) : null;

  // 1. Fetch active commercial banners
  const allActiveBanners = await db
    .select()
    .from(banners)
    .where(
      and(
        eq(banners.enabled, true),
        sql`now() >= ${banners.startsAt}`,
        or(isNull(banners.endsAt), sql`now() < ${banners.endsAt}`),
      ),
    )
    .orderBy(desc(banners.weight), banners.createdAt);

  // Filter banners by geotargeting
  const activeBanners = allActiveBanners
    .filter((b) => {
      // Global banners (no h3Index) always shown
      if (!b.h3Index) return true;
      // If user has no location, only show global banners
      if (!userCell) return false;
      // Check if user is within banner's hop count reach
      return isWithinReach(b.h3Index, userCell, b.hopCount ?? 0);
    })
    .slice(0, TOTAL_SLOTS);

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
    headerImageUrl: string | null;
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
    headerImageUrl: string | null;
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
        headerImageUrl: events.headerImageUrl,
        groupHandle: actors.handle,
        groupName: actors.name,
        organizerHandle: userFediverseAccounts.fediverseHandle,
        organizerDisplayName: users.displayName,
        organizerActorUrl: organizerActors.url,
      })
      .from(events)
      .innerJoin(actors, eq(events.groupActorId, actors.id))
      .innerJoin(users, eq(events.organizerId, users.id))
      .leftJoin(userFediverseAccounts, and(
        eq(userFediverseAccounts.userId, users.id),
        eq(userFediverseAccounts.isPrimary, true),
      ))
      .leftJoin(
        organizerActors,
        and(
          eq(organizerActors.handle, userFediverseAccounts.fediverseHandle),
          eq(organizerActors.isLocal, false),
        ),
      )
      .where(and(gte(events.startsAt, now), isNull(events.deletedAt)))
      .orderBy(desc(events.priority), events.startsAt)
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
          headerImageUrl: events.headerImageUrl,
          groupHandle: sql<null>`NULL`.as("group_handle"),
          groupName: sql<null>`NULL`.as("group_name"),
          organizerHandle: userFediverseAccounts.fediverseHandle,
          organizerDisplayName: users.displayName,
          organizerActorUrl: organizerActors.url,
        })
        .from(events)
        .innerJoin(users, eq(events.organizerId, users.id))
        .leftJoin(userFediverseAccounts, and(
          eq(userFediverseAccounts.userId, users.id),
          eq(userFediverseAccounts.isPrimary, true),
        ))
        .leftJoin(
          organizerActors,
          and(
            eq(organizerActors.handle, userFediverseAccounts.fediverseHandle),
            eq(organizerActors.isLocal, false),
          ),
        )
        .where(and(gte(events.startsAt, now), isNull(events.groupActorId), isNull(events.deletedAt)))
        .orderBy(desc(events.priority), events.startsAt)
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
