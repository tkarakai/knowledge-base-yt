import type { HistoryEntry } from "@repo/kb-shared";
import { youtubeChannelUrl, youtubeImageUrl } from "@repo/kb-shared";

export const localDay = (date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

/** Calendar months, including Feb 29 → Feb 28; independent of DST. */
export function twelveMonthsAgo(through: string): string {
  const [year, month, day] = through.split("-").map(Number);
  const last = new Date(Date.UTC(year - 1, month, 0)).getUTCDate();
  return `${year - 1}-${String(month).padStart(2, "0")}-${String(Math.min(day, last)).padStart(2, "0")}`;
}
const isoDay = (date: Date) => date.toISOString().slice(0, 10);
const months = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];
const weekdays = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

/** Fail closed on ambiguous/localized headings instead of guessing a watch date. */
export function historyDay(
  label: string,
  today: string,
  previous = today,
): string | null {
  const text = label.replace(/\s+/g, " ").trim().toLowerCase();
  if (text === "today") return today;
  if (text === "yesterday")
    return isoDay(new Date(Date.parse(today) - 86400000));
  const weekday = weekdays.indexOf(text);
  if (weekday !== -1) {
    const date = new Date(today);
    return isoDay(
      new Date(
        date.getTime() - ((date.getUTCDay() - weekday + 7) % 7) * 86400000,
      ),
    );
  }
  if (/^\d{4}-\d\d-\d\d$/.test(text)) {
    const date = new Date(text);
    return Number.isFinite(date.getTime()) && isoDay(date) === text
      ? text
      : null;
  }
  const clean = text.replace(
    /^(?:mon(?:day)?|tue(?:sday)?|wed(?:nesday)?|thu(?:rsday)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?),?\s+/,
    "",
  );
  const match = /^([a-z]+)\.? (\d{1,2})(?:,? (\d{4}))?$/.exec(clean);
  const reversed = /^(\d{1,2}) ([a-z]+)\.?(?:,? (\d{4}))?$/.exec(clean);
  if (!match && !reversed) return null;
  const monthName = match?.[1] ?? reversed![2];
  const month = months.findIndex(
    (name) =>
      name === monthName ||
      name.slice(0, 3) === monthName ||
      (name === "september" && monthName === "sept"),
  );
  if (month === -1) return null;
  const day = Number(match?.[2] ?? reversed![1]);
  const explicitYear = match?.[3] ?? reversed?.[3];
  let year = Number(explicitYear ?? previous.slice(0, 4));
  const candidate = () => new Date(Date.UTC(year, month, day));
  if (!explicitYear && isoDay(candidate()) > previous) year--;
  const date = candidate();
  if (date.getUTCMonth() !== month || date.getUTCDate() !== day) return null;
  return isoDay(date);
}

export interface Scan {
  entries: HistoryEntry[];
  reachedCutoff: boolean;
  oldest?: string;
  signature: string;
  continuation: Element | null;
  error?: string;
}
export function scanHistory(
  root: Element,
  cutoff: string,
  through: string,
  today = localDay(),
): Scan {
  const result: Scan = {
    entries: [],
    reachedCutoff: false,
    signature: "",
    continuation: root.querySelector("ytd-continuation-item-renderer"),
  };
  let previous = today;
  const parts: string[] = [];
  const sections = root.querySelectorAll("ytd-item-section-renderer");
  for (const section of sections) {
    const videos = section.querySelectorAll(
      "ytd-video-renderer, ytd-reel-item-renderer, yt-lockup-view-model, yt-shorts-lockup-view-model",
    );
    if (!videos.length) continue;
    const heading = section.querySelector(
      "ytd-item-section-header-renderer #title, ytd-item-section-header-renderer, :scope > #header h2, :scope > #header",
    );
    const label = heading?.textContent?.trim() ?? "";
    const day = historyDay(label, today, previous);
    if (!day || day > previous) {
      result.error = `Cannot safely read the history date “${label || "missing heading"}”. Use YouTube in English and retry. Nothing after this section was imported.`;
      break;
    }
    previous = day;
    result.oldest = day;
    parts.push(day);
    if (day < cutoff) {
      result.reachedCutoff = true;
      continue;
    }
    for (const video of videos) {
      const links = video.querySelectorAll<HTMLAnchorElement>(
        'a[href*="/watch?"], a[href*="/shorts/"]',
      );
      let videoId: string | null = null;
      for (const link of links) {
        const url = new URL(
          link.getAttribute("href")!,
          "https://www.youtube.com",
        );
        if (url.origin !== "https://www.youtube.com") continue;
        const id =
          url.pathname === "/watch"
            ? url.searchParams.get("v")
            : url.pathname.match(/^\/shorts\/([^/]+)$/)?.[1];
        if (id && /^[A-Za-z0-9_-]{11}$/.test(id)) {
          videoId = id;
          break;
        }
      }
      if (!videoId) continue; // Removed/private entries without an identifiable video.
      parts.push(videoId);
      if (day > through) continue;
      const title = video.querySelector(
        "#video-title, h3, .yt-lockup-metadata-view-model__title, .shortsLockupViewModelHostMetadataTitle",
      );
      const channel = video.querySelector(
        '#channel-name, .yt-content-metadata-view-model__metadata-row a, a[href^="/@"]',
      );
      const channelLink = Array.from(
        video.querySelectorAll<HTMLAnchorElement>("a[href]"),
      )
        .map((link) => youtubeChannelUrl(link.getAttribute("href")))
        .find(Boolean);
      const images = Array.from(
        video.querySelectorAll<HTMLImageElement>("img"),
      );
      const imageUrl = (kind: "thumbnail" | "avatar") =>
        images
          .flatMap((img) => [
            img.currentSrc,
            img.getAttribute("src"),
            img.getAttribute("data-src"),
            ...(img.getAttribute("srcset") ?? "")
              .split(",")
              .map((part) => part.trim().split(/\s+/)[0]),
          ])
          .map((value) => youtubeImageUrl(value, kind))
          .find(Boolean);
      result.entries.push({
        videoId,
        title: (title?.textContent ?? "").trim().slice(0, 1000),
        channel: (channel?.textContent ?? "").trim().slice(0, 500),
        watchedOn: day,
        ...(channelLink ? { channelUrl: channelLink } : {}),
        thumbnailUrl:
          imageUrl("thumbnail") ??
          `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`,
        ...(imageUrl("avatar") ? { channelAvatarUrl: imageUrl("avatar") } : {}),
      });
    }
  }
  result.signature = parts.join("|");
  if (
    !result.error &&
    !parts.length &&
    root.querySelector('a[href*="/watch?"], a[href*="/shorts/"]')
  )
    result.error =
      "YouTube’s history layout was not recognized. Import paused; no undated videos were imported.";
  return result;
}
