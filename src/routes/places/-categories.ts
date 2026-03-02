import { buildPlaceCategoryTree, flattenPlaceCategoryTree, getPlaceCategories } from "~/server/places/categories";

export const GET = async () => {
  const rows = await getPlaceCategories(false);
  const tree = buildPlaceCategoryTree(rows);

  return Response.json({
    categories: tree,
    options: flattenPlaceCategoryTree(tree),
  });
};
