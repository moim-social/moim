export type EventCategoryPresetItem = {
  slug: string;
  label: string;
};

export const EVENT_CATEGORY_PRESET: EventCategoryPresetItem[] = [
  { slug: "arts", label: "Arts" },
  { slug: "book_clubs", label: "Book Clubs" },
  { slug: "business", label: "Business" },
  { slug: "causes", label: "Causes" },
  { slug: "comedy", label: "Comedy" },
  { slug: "crafts", label: "Crafts" },
  { slug: "food_drink", label: "Food & Drink" },
  { slug: "health", label: "Health" },
  { slug: "music", label: "Music" },
  { slug: "auto_boat_air", label: "Auto, Boat & Air" },
  { slug: "community", label: "Community" },
  { slug: "family_education", label: "Family & Education" },
  { slug: "fashion_beauty", label: "Fashion & Beauty" },
  { slug: "film_media", label: "Film & Media" },
  { slug: "games", label: "Games" },
  { slug: "language_culture", label: "Language & Culture" },
  { slug: "learning", label: "Learning" },
  { slug: "lgbtq", label: "LGBTQ" },
  { slug: "movements_politics", label: "Movements & Politics" },
  { slug: "networking", label: "Networking" },
  { slug: "party", label: "Party" },
  { slug: "performing_visual_arts", label: "Performing & Visual Arts" },
  { slug: "pets", label: "Pets" },
  { slug: "photography", label: "Photography" },
  { slug: "outdoors_adventure", label: "Outdoors & Adventure" },
  { slug: "spirituality_religion_beliefs", label: "Spirituality, Religion & Beliefs" },
  { slug: "science_tech", label: "Science & Tech" },
  { slug: "sports", label: "Sports" },
  { slug: "theatre", label: "Theatre" },
  { slug: "meeting", label: "Meeting" },
  { slug: "programming", label: "Programming" },
];

export function flattenEventCategoryPreset(preset: EventCategoryPresetItem[]): EventCategoryPresetItem[] {
  return preset.map((item) => ({ slug: item.slug, label: item.label }));
}

// Backward-compatible exports — consumers should migrate to DB queries
export const CATEGORIES = EVENT_CATEGORY_PRESET.map((c) => ({ id: c.slug, label: c.label })) as ReadonlyArray<{ id: string; label: string }>;

export type CategoryId = string;
