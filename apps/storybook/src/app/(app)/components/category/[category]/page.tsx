import Link from "next/link";
import { notFound } from "next/navigation";
import { Separator } from "@repo/design-system";
import {
  componentRegistry,
  slugToCategory,
} from "@/lib/registry";

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const { category: categorySlug } = await params;
  const category = slugToCategory(categorySlug);

  if (!category) notFound();

  const components = componentRegistry.filter((c) => c.category === category);

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-4xl font-semibold tracking-tight text-foreground">
          {category}
        </h1>
        <p className="mt-2 text-base text-muted-foreground leading-relaxed">
          {components.length} component{components.length !== 1 && "s"} in this
          category.
        </p>
        <Separator className="mt-6" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {components.map((entry) => (
          <Link
            key={entry.slug}
            href={`/components/${entry.slug}`}
            className="group rounded-xl border bg-card p-6 transition-colors hover:bg-accent/50"
          >
            <h2 className="font-medium text-card-foreground group-hover:text-accent-foreground">
              {entry.name}
            </h2>
            <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">
              {entry.description}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
