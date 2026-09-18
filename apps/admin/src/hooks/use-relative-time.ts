"use client";

import { useEffect, useState } from "react";

const MINUTE = 60;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const MONTH = 30 * DAY;
const YEAR = 365 * DAY;

/** Two-day threshold in seconds for minute-level precision. */
const TWO_DAYS = 2 * DAY;
/** Seven-day threshold in seconds for hour-level precision. */
const SEVEN_DAYS = 7 * DAY;

function formatRelative(diffSeconds: number): string {
  const abs = Math.abs(diffSeconds);

  if (abs < MINUTE) return "just now";

  if (abs < TWO_DAYS) {
    const hours = Math.floor(abs / HOUR);
    const minutes = Math.floor((abs % HOUR) / MINUTE);
    if (hours === 0) return `${minutes}m`;
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }

  if (abs < SEVEN_DAYS) {
    const days = Math.floor(abs / DAY);
    const hours = Math.floor((abs % DAY) / HOUR);
    return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
  }

  if (abs < MONTH) {
    const days = Math.floor(abs / DAY);
    return `${days}d`;
  }

  if (abs < YEAR) {
    const months = Math.floor(abs / MONTH);
    return `${months}mo`;
  }

  const years = Math.floor(abs / YEAR);
  const remainingMonths = Math.floor((abs % YEAR) / MONTH);
  return remainingMonths > 0 ? `${years}y ${remainingMonths}mo` : `${years}y`;
}

function getUpdateInterval(diffSeconds: number): number {
  const abs = Math.abs(diffSeconds);
  if (abs < TWO_DAYS) return 60_000; // every minute
  if (abs < SEVEN_DAYS) return 300_000; // every 5 minutes
  return 3_600_000; // every hour
}

/**
 * Returns a dynamically updating relative time string for a past date.
 * Precision adapts based on distance: minutes within 2d, hours within 7d, etc.
 */
export function useTimeAgo(date: Date | null): string {
  const [now, setNow] = useState(Date.now);

  useEffect(() => {
    if (!date) return;
    const diff = Math.floor((Date.now() - date.getTime()) / 1000);
    const interval = setInterval(() => setNow(Date.now), getUpdateInterval(diff));
    return () => clearInterval(interval);
  }, [date]);

  if (!date) return "";
  const diff = Math.floor((now - date.getTime()) / 1000);
  if (diff <= 0) return "just now";
  const relative = formatRelative(diff);
  return relative === "just now" ? relative : `${relative} ago`;
}

/**
 * Returns a dynamically updating relative time string for a future date.
 * Precision adapts based on distance: minutes within 2d, hours within 7d, etc.
 */
export function useTimeUntil(date: Date | null): string {
  const [now, setNow] = useState(Date.now);

  useEffect(() => {
    if (!date) return;
    const diff = Math.floor((date.getTime() - Date.now()) / 1000);
    const interval = setInterval(() => setNow(Date.now), getUpdateInterval(diff));
    return () => clearInterval(interval);
  }, [date]);

  if (!date) return "";
  const diff = Math.floor((date.getTime() - now) / 1000);
  if (diff <= 0) return "expired";
  return `in ${formatRelative(diff)}`;
}
