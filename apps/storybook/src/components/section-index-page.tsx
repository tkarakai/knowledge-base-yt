import Link from "next/link";
import { Separator } from "@repo/design-system";

interface SectionItem {
  name: string;
  slug: string;
  description: string;
  itemPath: string;
}

interface SectionCategory {
  name: string;
  categoryPath: string;
  items: SectionItem[];
}

interface SectionIndexPageProps {
  title: string;
  totalCount: number;
  itemNoun: string;
  categories: SectionCategory[];
}

export function SectionIndexPage({
  title,
  totalCount,
  itemNoun,
  categories,
}: SectionIndexPageProps) {
  const plural = totalCount !== 1 ? `${itemNoun}s` : itemNoun;

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-4xl font-semibold tracking-tight text-foreground">
          {title}
        </h1>
        <p className="mt-2 text-base text-muted-foreground leading-relaxed">
          {totalCount} {plural} across {categories.length}{" "}
          {categories.length !== 1 ? "categories" : "category"}.
        </p>
        <Separator className="mt-6" />
      </div>

      {categories.map((category) => (
        <section key={category.name} className="space-y-4">
          <div className="flex items-baseline justify-between">
            <h2 className="text-2xl font-semibold tracking-tight text-foreground">
              {category.name}
            </h2>
            <Link
              href={category.categoryPath}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              View all
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {category.items.map((item) => (
              <Link
                key={item.slug}
                href={item.itemPath}
                className="group rounded-xl border bg-card p-6 transition-colors hover:bg-accent/50"
              >
                <h3 className="font-medium text-card-foreground group-hover:text-accent-foreground">
                  {item.name}
                </h3>
                <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">
                  {item.description}
                </p>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
