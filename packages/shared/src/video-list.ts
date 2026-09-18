import type { Source } from "./index";

export const releaseDay = (source: Source) =>
  source.publishedOn ?? source.publishedAt?.slice(0, 10);
export function videoGroups(
  sources: Source[],
  query: string,
  grouped: boolean,
) {
  const needle = query.trim().toLocaleLowerCase();
  const videos = sources
    .filter(
      (source) =>
        !needle ||
        `${source.title}\n${source.channel}`
          .toLocaleLowerCase()
          .includes(needle),
    )
    .sort(
      (a, b) =>
        (releaseDay(b) ?? "").localeCompare(releaseDay(a) ?? "") ||
        a.title.localeCompare(b.title) ||
        a.id.localeCompare(b.id),
    );
  if (!grouped) return [{ key: "all", label: "", videos }];
  const groups = new Map<
    string,
    { key: string; label: string; videos: Source[] }
  >();
  for (const video of videos) {
    const label = video.channel || "Unknown channel";
    const key = video.channelUrl ?? label.toLocaleLowerCase();
    if (!groups.has(key)) groups.set(key, { key, label, videos: [] });
    groups.get(key)!.videos.push(video);
  }
  return [...groups.values()].sort(
    (a, b) => a.label.localeCompare(b.label) || a.key.localeCompare(b.key),
  );
}
