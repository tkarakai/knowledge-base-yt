import { notFound } from "next/navigation";
import { foundationRegistry } from "@/lib/foundation-registry";
import { ComponentPage } from "@/components/component-page";
import { foundationShowcaseMap } from "@/showcase/foundations";

export default async function FoundationSlugPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const entry = foundationRegistry.find((c) => c.slug === slug);

  if (!entry) {
    notFound();
  }

  const Showcase = foundationShowcaseMap[slug];

  if (!Showcase) {
    notFound();
  }

  return (
    <ComponentPage title={entry.name} description={entry.description}>
      <Showcase />
    </ComponentPage>
  );
}
