import { notFound } from "next/navigation";
import { patternRegistry } from "@/lib/pattern-registry";
import { ComponentPage } from "@/components/component-page";
import { patternShowcaseMap } from "@/showcase/patterns";

export default async function PatternSlugPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const entry = patternRegistry.find((c) => c.slug === slug);

  if (!entry) {
    notFound();
  }

  const Showcase = patternShowcaseMap[slug];

  if (!Showcase) {
    notFound();
  }

  return (
    <ComponentPage title={entry.name} description={entry.description}>
      <Showcase />
    </ComponentPage>
  );
}
