import { expect, test } from "bun:test";
import type { Source } from "@repo/kb-shared";
import { releaseDay, videoGroups } from "../../src/lib/kb/video-list";
const video = (
  id: string,
  title: string,
  channel: string,
  publishedOn?: string,
) =>
  ({
    id,
    title,
    channel,
    publishedOn,
    firstSeenAt: "2026-09-16T00:00:00Z",
    history: { watchedOn: "2026-09-16" },
  }) as Source;
const videos = [
  video("a", "Older discovery", "Alpha", "2020-01-01"),
  video("b", "Newest idea", "Beta", "2026-08-30"),
  video("c", "Recent discovery", "Alpha", "2025-06-20"),
  video("d", "Unknown release", "Beta"),
];
test("release descending; neither discovery nor watch date substitutes for release date", () => {
  expect(videoGroups(videos, "", false)[0].videos.map((v) => v.id)).toEqual([
    "b",
    "c",
    "a",
    "d",
  ]);
  expect(releaseDay(videos[3])).toBeUndefined();
});
test("channel groups retain descending releases and substring matching is case-insensitive", () => {
  expect(
    videoGroups(videos, "", true).map((g) => [
      g.label,
      g.videos.map((v) => v.id),
    ]),
  ).toEqual([
    ["Alpha", ["c", "a"]],
    ["Beta", ["b", "d"]],
  ]);
  expect(
    videoGroups(videos, "  DISCOV  ", false)[0].videos.map((v) => v.id),
  ).toEqual(["c", "a"]);
  expect(videoGroups(videos, "ALP", true)[0].videos.map((v) => v.id)).toEqual([
    "c",
    "a",
  ]);
  expect(videoGroups(videos, "not found", true)).toEqual([]);
});
