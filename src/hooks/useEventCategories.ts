import { useState, useEffect } from "react";

export type EventCategoryOption = {
  slug: string;
  label: string;
  emoji: string | null;
  description: string | null;
};

let cachedCategories: EventCategoryOption[] | null = null;
let fetchPromise: Promise<EventCategoryOption[]> | null = null;

function fetchCategories(): Promise<EventCategoryOption[]> {
  if (cachedCategories) return Promise.resolve(cachedCategories);
  if (fetchPromise) return fetchPromise;
  fetchPromise = fetch("/api/event-categories")
    .then((r) => r.json())
    .then((data) => {
      cachedCategories = data.categories ?? [];
      fetchPromise = null;
      return cachedCategories!;
    })
    .catch(() => {
      fetchPromise = null;
      return [];
    });
  return fetchPromise;
}

export function useEventCategories() {
  const [categories, setCategories] = useState<EventCategoryOption[]>(cachedCategories ?? []);
  const [loading, setLoading] = useState(!cachedCategories);

  useEffect(() => {
    fetchCategories().then((cats) => {
      setCategories(cats);
      setLoading(false);
    });
  }, []);

  return { categories, loading };
}

export function useEventCategoryMap() {
  const { categories, loading } = useEventCategories();
  const categoryMap = new Map(categories.map((c) => [c.slug, c.label]));
  const categoryDetailMap = new Map(categories.map((c) => [c.slug, c]));
  return { categoryMap, categoryDetailMap, loading };
}
