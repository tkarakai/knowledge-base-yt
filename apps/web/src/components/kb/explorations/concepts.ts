export const concepts = [
  {
    id: "workbench",
    number: "01",
    name: "Workbench",
    tagline: "Everything within reach.",
    description:
      "A compact workspace with a source queue, a reading pane, and your reflection side by side.",
    best: "Processing videos and writing reflections",
    tradeoff: "More information on screen at once",
    layout: "Queue → source → reflection",
  },
  {
    id: "pipeline",
    number: "02",
    name: "Pipeline",
    tagline: "Always know what comes next.",
    description:
      "A visible path from captured video to accepted knowledge. Pick a stage, see the work, move it forward.",
    best: "Building a regular learning habit",
    tradeoff: "Less emphasis on browsing finished notes",
    layout: "Capture → reflect → review → keep",
  },
  {
    id: "library",
    number: "03",
    name: "Library",
    tagline: "Start with what you know.",
    description:
      "A knowledge-first home with topic shelves, searchable notes, and source material close at hand.",
    best: "Research, rediscovery, and connecting ideas",
    tradeoff: "Your capture queue is a secondary destination",
    layout: "Topics → notes → supporting sources",
  },
] as const;
export type ConceptId = (typeof concepts)[number]["id"];
export function isConcept(value: string | undefined): value is ConceptId {
  return concepts.some((concept) => concept.id === value);
}
