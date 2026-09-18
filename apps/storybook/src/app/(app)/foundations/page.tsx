import { SectionIndexPage } from "@/components/section-index-page";
import {
  foundationCategoryOrder,
  foundationCategoryToSlug,
  foundationRegistry,
  getFoundationsByCategory,
} from "@/lib/foundation-registry";

export default function FoundationsIndexPage() {
  const byCategory = getFoundationsByCategory();

  return (
    <SectionIndexPage
      title="Foundations"
      totalCount={foundationRegistry.length}
      itemNoun="foundation"
      categories={foundationCategoryOrder.map((cat) => ({
        name: cat,
        categoryPath: `/foundations/category/${foundationCategoryToSlug(cat)}`,
        items: byCategory[cat].map((entry) => ({
          name: entry.name,
          slug: entry.slug,
          description: entry.description,
          itemPath: `/foundations/${entry.slug}`,
        })),
      }))}
    />
  );
}
