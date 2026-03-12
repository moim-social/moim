import { createFileRoute, Link } from "@tanstack/react-router";
import { CATEGORIES } from "~/shared/categories";
import { pickGradient } from "~/shared/gradients";
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
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Categories</h2>
        <p className="text-muted-foreground mt-1">
          Browse events by category. Follow category feeds from your fediverse account.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {CATEGORIES.map((cat) => {
          const [gradFrom, gradTo] = pickGradient(cat.id);
          return (
            <Link
              key={cat.id}
              to="/categories/$categoryId"
              params={{ categoryId: cat.id }}
              className="block"
            >
              <Card className="overflow-hidden transition-shadow hover:shadow-md py-0 gap-0">
                <div
                  className="h-16"
                  style={{
                    background: `linear-gradient(135deg, ${gradFrom}, ${gradTo})`,
                  }}
                />
                <CardContent className="py-3 px-4">
                  <p className="font-medium text-sm truncate">{cat.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">@feed_{cat.id}</p>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
