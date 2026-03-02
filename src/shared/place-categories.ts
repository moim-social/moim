export type PlaceCategoryPresetNode = {
  id: string;
  slug: string;
  label: string;
  emoji: string;
  children?: PlaceCategoryPresetNode[];
};

export const PLACE_CATEGORY_PRESET: PlaceCategoryPresetNode[] = [
  {
    id: "food_drink",
    slug: "food-drink",
    label: "Food & Drink",
    emoji: "🍽️",
    children: [
      {
        id: "cafe",
        slug: "cafe",
        label: "Cafe",
        emoji: "☕",
        children: [
          {
            id: "specialty_coffee",
            slug: "specialty-coffee",
            label: "Specialty Coffee",
            emoji: "🫘",
          },
        ],
      },
      {
        id: "restaurant",
        slug: "restaurant",
        label: "Restaurant",
        emoji: "🍜",
      },
      {
        id: "bar",
        slug: "bar",
        label: "Bar",
        emoji: "🍺",
      },
      {
        id: "bakery",
        slug: "bakery",
        label: "Bakery",
        emoji: "🥐",
      },
    ],
  },
  {
    id: "arts_culture",
    slug: "arts-culture",
    label: "Arts & Culture",
    emoji: "🎭",
    children: [
      {
        id: "gallery",
        slug: "gallery",
        label: "Gallery",
        emoji: "🖼️",
      },
      {
        id: "museum",
        slug: "museum",
        label: "Museum",
        emoji: "🏛️",
      },
      {
        id: "theater",
        slug: "theater",
        label: "Theater",
        emoji: "🎟️",
      },
      {
        id: "library",
        slug: "library",
        label: "Library",
        emoji: "📚",
      },
    ],
  },
  {
    id: "community_work",
    slug: "community-work",
    label: "Community & Work",
    emoji: "🏘️",
    children: [
      {
        id: "community_center",
        slug: "community-center",
        label: "Community Center",
        emoji: "🏠",
      },
      {
        id: "coworking",
        slug: "coworking",
        label: "Coworking Space",
        emoji: "💼",
      },
      {
        id: "meetup_space",
        slug: "meetup-space",
        label: "Meetup Space",
        emoji: "💬",
      },
    ],
  },
  {
    id: "outdoors",
    slug: "outdoors",
    label: "Outdoors",
    emoji: "🌳",
    children: [
      {
        id: "park",
        slug: "park",
        label: "Park",
        emoji: "🌿",
      },
      {
        id: "trail",
        slug: "trail",
        label: "Trail",
        emoji: "🥾",
      },
      {
        id: "beach",
        slug: "beach",
        label: "Beach",
        emoji: "🏖️",
      },
    ],
  },
  {
    id: "shopping",
    slug: "shopping",
    label: "Shopping",
    emoji: "🛍️",
    children: [
      {
        id: "market",
        slug: "market",
        label: "Market",
        emoji: "🛒",
      },
      {
        id: "bookstore",
        slug: "bookstore",
        label: "Bookstore",
        emoji: "📖",
      },
      {
        id: "mall",
        slug: "mall",
        label: "Mall",
        emoji: "🏬",
      },
    ],
  },
  {
    id: "education_making",
    slug: "education-making",
    label: "Education & Making",
    emoji: "🎓",
    children: [
      {
        id: "school",
        slug: "school",
        label: "School",
        emoji: "🏫",
      },
      {
        id: "workshop_space",
        slug: "workshop-space",
        label: "Workshop Space",
        emoji: "🛠️",
      },
      {
        id: "studio",
        slug: "studio",
        label: "Studio",
        emoji: "🎙️",
      },
    ],
  },
  {
    id: "sports_wellness",
    slug: "sports-wellness",
    label: "Sports & Wellness",
    emoji: "💪",
    children: [
      {
        id: "gym",
        slug: "gym",
        label: "Gym",
        emoji: "🏋️",
      },
      {
        id: "yoga_studio",
        slug: "yoga-studio",
        label: "Yoga Studio",
        emoji: "🧘",
      },
      {
        id: "climbing_gym",
        slug: "climbing-gym",
        label: "Climbing Gym",
        emoji: "🧗",
      },
    ],
  },
  {
    id: "nightlife_fun",
    slug: "nightlife-fun",
    label: "Nightlife & Fun",
    emoji: "🎉",
    children: [
      {
        id: "club",
        slug: "club",
        label: "Club",
        emoji: "💃",
      },
      {
        id: "karaoke",
        slug: "karaoke",
        label: "Karaoke",
        emoji: "🎤",
      },
      {
        id: "arcade",
        slug: "arcade",
        label: "Arcade",
        emoji: "🕹️",
      },
    ],
  },
];

export type PlaceCategoryPresetFlatNode = {
  id: string;
  slug: string;
  label: string;
  emoji: string;
  parentId: string | null;
  depth: number;
  sortOrder: number;
};

export function flattenPlaceCategoryPreset(
  nodes: PlaceCategoryPresetNode[],
  parentId: string | null = null,
  depth = 0,
): PlaceCategoryPresetFlatNode[] {
  return nodes.flatMap((node, sortOrder) => [
    {
      id: node.id,
      slug: node.slug,
      label: node.label,
      emoji: node.emoji,
      parentId,
      depth,
      sortOrder,
    },
    ...flattenPlaceCategoryPreset(node.children ?? [], node.id, depth + 1),
  ]);
}
