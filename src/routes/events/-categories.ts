import { getEventCategories } from "~/server/events/categories";

export const GET = async () => {
  const categories = await getEventCategories(false);
  return Response.json({ categories });
};
