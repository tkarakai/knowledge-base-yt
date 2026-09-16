export type FoundationCategory = "Visual" | "Layout";

export interface FoundationEntry {
  /** Display name shown in sidebar and headings */
  name: string;
  /** URL slug used in /foundations/<slug> routes */
  slug: string;
  /** Grouping category for sidebar navigation */
  category: FoundationCategory;
  /** Short description for overview cards */
  description: string;
}

export const foundationRegistry: FoundationEntry[] = [
  // Visual
  {
    name: "Colors",
    slug: "colors",
    category: "Visual",
    description:
      "Semantic color tokens with OKLCH values for light and dark themes.",
  },
  {
    name: "Typography",
    slug: "typography",
    category: "Visual",
    description: "Font family, sizes, weights, tracking, and line heights.",
  },
  {
    name: "Icons",
    slug: "icons",
    category: "Visual",
    description:
      "Dynamically discovered Lucide icon library with search.",
  },
  {
    name: "Shadows",
    slug: "shadows",
    category: "Visual",
    description: "Elevation levels from subtle to pronounced.",
  },
  {
    name: "Glows",
    slug: "glows",
    category: "Visual",
    description:
      "Radial glow tokens for page and card backgrounds.",
  },
  {
    name: "Border Radius",
    slug: "border-radius",
    category: "Visual",
    description: "Corner rounding tokens from sm to xl.",
  },

  // Layout
  {
    name: "Spacing",
    slug: "spacing",
    category: "Layout",
    description:
      "The spacing scale used for margins, padding, and gaps.",
  },
];

/** Foundation categories in display order */
export const foundationCategoryOrder: FoundationCategory[] = [
  "Visual",
  "Layout",
];

/** Convert a foundation category name to a URL-friendly slug */
export function foundationCategoryToSlug(
  category: FoundationCategory,
): string {
  return category.toLowerCase().replace(/\s+/g, "-");
}

/** Resolve a URL slug back to a foundation category name */
export function slugToFoundationCategory(
  slug: string,
): FoundationCategory | undefined {
  return foundationCategoryOrder.find(
    (c) => foundationCategoryToSlug(c) === slug,
  );
}

/** Group foundation entries by category */
export function getFoundationsByCategory(): Record<
  FoundationCategory,
  FoundationEntry[]
> {
  const grouped = {} as Record<FoundationCategory, FoundationEntry[]>;
  for (const cat of foundationCategoryOrder) {
    grouped[cat] = foundationRegistry.filter((c) => c.category === cat);
  }
  return grouped;
}
