import { type SQL, aliasedTable, and, desc, eq, gte, lt } from "drizzle-orm";
import { db } from "~/server/db/client";
import { events, actors, users, userFediverseAccounts } from "~/server/db/schema";

export const GET = async ({ request }: { request: Request }) => {
  const url = new URL(request.url);
  const past = url.searchParams.get("past") === "1";
  const category = url.searchParams.get("category");
  const country = url.searchParams.get("country");
  const now = new Date();

  const conditions: SQL[] = [eq(events.published, true)];
  if (category) conditions.push(eq(events.categoryId, category));
  if (country) conditions.push(eq(events.country, country));
  conditions.push(past ? lt(events.startsAt, now) : gte(events.startsAt, now));

  const organizerActors = aliasedTable(actors, "organizer_actors");
  const rows = await db
    .select({
      id: events.id,
      title: events.title,
      description: events.description,
      categoryId: events.categoryId,
      country: events.country,
      startsAt: events.startsAt,
      endsAt: events.endsAt,
      timezone: events.timezone,
      location: events.location,
      headerImageUrl: events.headerImageUrl,
      createdAt: events.createdAt,
      groupHandle: actors.handle,
      groupName: actors.name,
      organizerHandle: userFediverseAccounts.fediverseHandle,
      organizerDisplayName: users.displayName,
      organizerActorUrl: organizerActors.url,
    })
    .from(events)
    .leftJoin(actors, eq(events.groupActorId, actors.id))
    .innerJoin(users, eq(events.organizerId, users.id))
    .leftJoin(userFediverseAccounts, and(
      eq(userFediverseAccounts.userId, users.id),
      eq(userFediverseAccounts.isPrimary, true),
    ))
    .leftJoin(organizerActors, and(
      eq(organizerActors.handle, userFediverseAccounts.fediverseHandle),
      eq(organizerActors.isLocal, false),
    ))
    .where(and(...conditions))
    .orderBy(past ? desc(events.startsAt) : events.startsAt);

  return Response.json({ events: rows });
};
