import { notFound } from "next/navigation";
import { componentRegistry } from "@/lib/registry";
import { ComponentPage } from "@/components/component-page";
import { showcaseMap } from "@/showcase";

export default async function ComponentSlugPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const entry = componentRegistry.find((c) => c.slug === slug);

  if (!entry) {
    notFound();
  }

  const Showcase = showcaseMap[slug];

  if (!Showcase) {
    notFound();
  }

  return (
    <ComponentPage title={entry.name} description={entry.description}>
      <Showcase />
    </ComponentPage>
  );
}
