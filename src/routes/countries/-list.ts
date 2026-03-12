import { db } from "~/server/db/client";
import { countries } from "~/server/db/schema";

export const GET = async () => {
  const rows = await db
    .select({ code: countries.code, name: countries.name })
    .from(countries)
    .orderBy(countries.name);

  return Response.json({ countries: rows });
};
