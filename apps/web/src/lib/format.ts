const units = ["B", "KB", "MB", "GB", "TB"];

export function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes < 0) return "0 B";
  if (bytes === 0) return "0 B";

  const base = 1024;
  const exponent = Math.min(
    Math.floor(Math.log(bytes) / Math.log(base)),
    units.length - 1
  );
  const value = bytes / Math.pow(base, exponent);

  return `${value.toFixed(value >= 10 || exponent === 0 ? 0 : 1)} ${
    units[exponent]
  }`;
}

type FormatOptions = {
  locale?: string;
  timeZone?: string;
};

export function formatDateTime(
  value: number | Date,
  options?: FormatOptions,
) {
  const date = typeof value === "number" ? new Date(value) : value;
  return new Intl.DateTimeFormat(options?.locale ?? "en", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: options?.timeZone,
  }).format(date);
}

export function formatDeadline(
  value: number | Date,
  options?: FormatOptions,
) {
  const date = typeof value === "number" ? new Date(value) : value;
  return new Intl.DateTimeFormat(options?.locale ?? "en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: options?.timeZone,
  }).format(date);
}

export type DeadlineUrgency = "overdue" | "urgent" | "normal" | "done";

export function getDeadlineUrgency(
  deadline: number,
  status: string,
): DeadlineUrgency {
  if (status === "done") return "done";

  const now = Date.now();
  if (deadline < now) return "overdue";

  const twentyFourHours = 24 * 60 * 60 * 1000;
  if (deadline - now < twentyFourHours) return "urgent";

  return "normal";
}
