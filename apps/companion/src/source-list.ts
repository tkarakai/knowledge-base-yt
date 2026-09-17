import { videoGroups, type Source, type SourcePage } from "@repo/kb-shared";
import { ApiError } from "./state";

export function sourcePage(
  sources: Source[],
  params: URLSearchParams,
): SourcePage {
  const pageSize = 50;
  const requested = Number(params.get("page") ?? 1);
  const tab = params.get("tab") ?? "inbox";
  if (
    !Number.isSafeInteger(requested) ||
    requested < 1 ||
    !["inbox", "later", "all"].includes(tab)
  )
    throw new ApiError(400, "Invalid video page");
  const counts = { inbox: 0, later: 0, all: sources.length };
  const filtered = sources.filter((source) => {
    if (source.status === "ready_for_reflection") counts.inbox++;
    if (source.status === "deferred") counts.later++;
    return (
      tab === "all" ||
      source.status === (tab === "later" ? "deferred" : "ready_for_reflection")
    );
  });
  const groups = videoGroups(
    filtered,
    (params.get("q") ?? "").slice(0, 2000),
    params.get("group") === "channel",
  );
  const total = groups.reduce((count, group) => count + group.videos.length, 0);
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(requested, pages);
  const start = (page - 1) * pageSize;
  let offset = 0;
  const visible = groups.flatMap((group) => {
    const from = Math.max(0, start - offset);
    const to = Math.min(group.videos.length, start + pageSize - offset);
    offset += group.videos.length;
    return to > from
      ? [
          {
            ...group,
            total: group.videos.length,
            videos: group.videos.slice(from, to),
          },
        ]
      : [];
  });
  return { groups: visible, counts, total, page, pages, pageSize };
}
