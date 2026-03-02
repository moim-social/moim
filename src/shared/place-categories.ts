export type PlaceCategoryPresetNode = {
  slug: string;
  label: string;
  emoji: string;
  children?: PlaceCategoryPresetNode[];
};

export const PLACE_CATEGORY_PRESET: PlaceCategoryPresetNode[] = [
  {
    slug: "food-drink",
    label: "Food & Drink",
    emoji: "🍽️",
    children: [
      {
        slug: "cafe",
        label: "Cafe",
        emoji: "☕",
        children: [
          {
            slug: "specialty-coffee",
            label: "Specialty Coffee",
            emoji: "🫘",
          },
        ],
      },
      {
        slug: "restaurant",
        label: "Restaurant",
        emoji: "🍜",
      },
      {
        slug: "bar",
        label: "Bar",
        emoji: "🍺",
      },
      {
        slug: "bakery",
        label: "Bakery",
        emoji: "🥐",
      },
    ],
  },
  {
    slug: "arts-culture",
    label: "Arts & Culture",
    emoji: "🎭",
    children: [
      {
        slug: "gallery",
        label: "Gallery",
        emoji: "🖼️",
      },
      {
        slug: "museum",
        label: "Museum",
        emoji: "🏛️",
      },
      {
        slug: "theater",
        label: "Theater",
        emoji: "🎟️",
      },
      {
        slug: "library",
        label: "Library",
        emoji: "📚",
      },
    ],
  },
  {
    slug: "community-work",
    label: "Community & Work",
    emoji: "🏘️",
    children: [
      {
        slug: "community-center",
        label: "Community Center",
        emoji: "🏠",
      },
      {
        slug: "coworking",
        label: "Coworking Space",
        emoji: "💼",
      },
      {
        slug: "meetup-space",
        label: "Meetup Space",
        emoji: "💬",
      },
    ],
  },
  {
    slug: "outdoors",
    label: "Outdoors",
    emoji: "🌳",
    children: [
      {
        slug: "park",
        label: "Park",
        emoji: "🌿",
      },
      {
        slug: "trail",
        label: "Trail",
        emoji: "🥾",
      },
      {
        slug: "beach",
        label: "Beach",
        emoji: "🏖️",
      },
    ],
  },
  {
    slug: "shopping",
    label: "Shopping",
    emoji: "🛍️",
    children: [
      {
        slug: "market",
        label: "Market",
        emoji: "🛒",
      },
      {
        slug: "bookstore",
        label: "Bookstore",
        emoji: "📖",
      },
      {
        slug: "mall",
        label: "Mall",
        emoji: "🏬",
      },
    ],
  },
  {
    slug: "education-making",
    label: "Education & Making",
    emoji: "🎓",
    children: [
      {
        slug: "school",
        label: "School",
        emoji: "🏫",
      },
      {
        slug: "workshop-space",
        label: "Workshop Space",
        emoji: "🛠️",
      },
      {
        slug: "studio",
        label: "Studio",
        emoji: "🎙️",
      },
    ],
  },
  {
    slug: "sports-wellness",
    label: "Sports & Wellness",
    emoji: "💪",
    children: [
      {
        slug: "gym",
        label: "Gym",
        emoji: "🏋️",
      },
      {
        slug: "yoga-studio",
        label: "Yoga Studio",
        emoji: "🧘",
      },
      {
        slug: "climbing-gym",
        label: "Climbing Gym",
        emoji: "🧗",
      },
    ],
  },
  {
    slug: "nightlife-fun",
    label: "Nightlife & Fun",
    emoji: "🎉",
    children: [
      {
        slug: "club",
        label: "Club",
        emoji: "💃",
      },
      {
        slug: "karaoke",
        label: "Karaoke",
        emoji: "🎤",
      },
      {
        slug: "arcade",
        label: "Arcade",
        emoji: "🕹️",
      },
    ],
  },
];

export type PlaceCategoryPresetFlatNode = {
  slug: string;
  label: string;
  emoji: string;
  parentSlug: string | null;
  depth: number;
  sortOrder: number;
};

export function flattenPlaceCategoryPreset(
  nodes: PlaceCategoryPresetNode[],
  parentSlug: string | null = null,
  depth = 0,
): PlaceCategoryPresetFlatNode[] {
  return nodes.flatMap((node, sortOrder) => [
    {
      slug: node.slug,
      label: node.label,
      emoji: node.emoji,
      parentSlug,
      depth,
      sortOrder,
    },
    ...flattenPlaceCategoryPreset(node.children ?? [], node.slug, depth + 1),
  ]);
}
