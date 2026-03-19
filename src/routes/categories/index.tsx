import { createFileRoute, Link } from "@tanstack/react-router";
import { useEventCategories } from "~/hooks/useEventCategories";

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
    <div>
      {/* Header */}
      <div className="pb-4 border-b-2 border-foreground mb-6">
        <h2 className="text-2xl font-extrabold tracking-tight">Categories</h2>
        <p className="text-sm text-[#888] mt-1">
          Browse events by category. Follow feeds from your fediverse account.
        </p>
      </div>

      <div className="divide-y divide-[#f0f0f0]">
        {categories.map((cat) => (
          <Link
            key={cat.slug}
            to="/categories/$categoryId"
            params={{ categoryId: cat.slug }}
            className="flex items-center justify-between py-4 first:pt-0 hover:bg-[#fafafa] transition-colors group"
          >
            <div>
              <span className="text-[15px] font-bold tracking-tight group-hover:underline">{cat.label}</span>
              <p className="text-[12px] text-[#999] mt-0.5">@feed_{cat.slug}</p>
            </div>
            <span className="text-[13px] text-[#bbb]">&rsaquo;</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
