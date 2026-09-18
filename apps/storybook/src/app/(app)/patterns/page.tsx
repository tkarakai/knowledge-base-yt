import { SectionIndexPage } from "@/components/section-index-page";
import {
  getPatternsByCategory,
  patternCategoryOrder,
  patternCategoryToSlug,
  patternRegistry,
} from "@/lib/pattern-registry";

export default function PatternsIndexPage() {
  const byCategory = getPatternsByCategory();

  return (
    <SectionIndexPage
      title="Patterns"
      totalCount={patternRegistry.length}
      itemNoun="pattern"
      categories={patternCategoryOrder.map((cat) => ({
        name: cat,
        categoryPath: `/patterns/category/${patternCategoryToSlug(cat)}`,
        items: byCategory[cat].map((entry) => ({
          name: entry.name,
          slug: entry.slug,
          description: entry.description,
          itemPath: `/patterns/${entry.slug}`,
        })),
      }))}
    />
  );
}
