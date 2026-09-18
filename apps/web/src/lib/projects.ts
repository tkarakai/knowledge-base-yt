export const taskStatuses = ["todo", "in_progress", "done"] as const;
export type TaskStatus = (typeof taskStatuses)[number];

export function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}
