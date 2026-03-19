import { createFileRoute, Link } from "@tanstack/react-router";
import { useEventCategories } from "~/hooks/useEventCategories";
import {
  Card,
  CardContent,
} from "~/components/ui/card";

export const Route = createFileRoute("/categories/")({
  component: CategoriesPage,
  head: () => ({
    meta: [
      { title: "Categories — Moim" },
      { name: "description", content: "Browse event categories on Moim." },
      { property: "og:title", content: "Categories — Moim" },
      { property: "og:description", content: "Browse event categories on Moim." },
      { property: "og:type", content: "website" },
    ],
  }),
});

function CategoriesPage() {
  const { categories, loading } = useEventCategories();

  if (loading) {
    return <p className="text-muted-foreground">Loading categories...</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Categories</h2>
        <p className="text-muted-foreground mt-1">
          Browse events by category. Follow category feeds from your fediverse account.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {categories.map((cat) => {
          return (
            <Link
              key={cat.slug}
              to="/categories/$categoryId"
              params={{ categoryId: cat.slug }}
              className="block"
            >
              <Card className="overflow-hidden transition-colors hover:bg-[#fafafa] py-0 gap-0 bg-muted/30 border">
                <CardContent className="py-4 px-4">
                  <p className="font-bold text-base truncate tracking-tight">{cat.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">@feed_{cat.slug}</p>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
