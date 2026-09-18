import Link from "next/link";
import { notFound } from "next/navigation";
import { Separator } from "@repo/design-system";
import {
  foundationRegistry,
  slugToFoundationCategory,
} from "@/lib/foundation-registry";

export default async function FoundationCategoryPage({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const { category: categorySlug } = await params;
  const category = slugToFoundationCategory(categorySlug);

  if (!category) notFound();

  const foundations = foundationRegistry.filter((c) => c.category === category);

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-4xl font-semibold tracking-tight text-foreground">
          {category}
        </h1>
        <p className="mt-2 text-base text-muted-foreground leading-relaxed">
          {foundations.length} foundation{foundations.length !== 1 && "s"} in
          this category.
        </p>
        <Separator className="mt-6" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {foundations.map((entry) => (
          <Link
            key={entry.slug}
            href={`/foundations/${entry.slug}`}
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
