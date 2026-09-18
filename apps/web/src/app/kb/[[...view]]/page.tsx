import { Workspace } from "@/components/kb/workspace";
import { notFound } from "next/navigation";

export default async function KnowledgePage({
  params,
}: {
  params: Promise<{ view?: string[] }>;
}) {
  let view: string[];
  try {
    view = ((await params).view ?? []).map(decodeURIComponent);
  } catch {
    notFound();
  }
  return <Workspace view={view} />;
}
