export type PasswordRole = "admin" | "user";

const MIN_LENGTHS: Record<PasswordRole, number> = {
  admin: 40,
  user: 12,
};

export function getMinPasswordLength(role: PasswordRole): number {
  return MIN_LENGTHS[role];
}

/**
 * Format a duration in seconds to a human-readable crack time string.
 * Uses the provided translation function for localized output.
 */
export function formatCrackTime(
  seconds: number,
  t: (key: string, params?: Record<string, string | number>) => string,
): string {
  if (seconds < 1) return t("timeEstimation.ltSecond");

  const MINUTE = 60;
  const HOUR = 3_600;
  const DAY = 86_400;
  const MONTH = 2_592_000; // 30 days
  const YEAR = 31_536_000; // 365 days
  const CENTURY = 3_153_600_000;

  if (seconds >= CENTURY) return t("timeEstimation.centuries");

  let base: number;
  let unit: string;

  if (seconds < MINUTE) {
    base = Math.round(seconds);
    unit = base === 1 ? "second" : "seconds";
  } else if (seconds < HOUR) {
    base = Math.round(seconds / MINUTE);
    unit = base === 1 ? "minute" : "minutes";
  } else if (seconds < DAY) {
    base = Math.round(seconds / HOUR);
    unit = base === 1 ? "hour" : "hours";
  } else if (seconds < MONTH) {
    base = Math.round(seconds / DAY);
    unit = base === 1 ? "day" : "days";
  } else if (seconds < YEAR) {
    base = Math.round(seconds / MONTH);
    unit = base === 1 ? "month" : "months";
  } else {
    base = Math.round(seconds / YEAR);
    unit = base === 1 ? "year" : "years";
  }

  return t(`timeEstimation.${unit}`, { base });
}
