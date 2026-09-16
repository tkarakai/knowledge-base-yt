import { SectionIndexPage } from "@/components/section-index-page";
import {
  categoryOrder,
  categoryToSlug,
  componentRegistry,
  getComponentsByCategory,
} from "@/lib/registry";

export default function ComponentsIndexPage() {
  const byCategory = getComponentsByCategory();

  return (
    <SectionIndexPage
      title="Components"
      totalCount={componentRegistry.length}
      itemNoun="component"
      categories={categoryOrder.map((cat) => ({
        name: cat,
        categoryPath: `/components/category/${categoryToSlug(cat)}`,
        items: byCategory[cat].map((entry) => ({
          name: entry.name,
          slug: entry.slug,
          description: entry.description,
          itemPath: `/components/${entry.slug}`,
        })),
      }))}
    />
  );
}
