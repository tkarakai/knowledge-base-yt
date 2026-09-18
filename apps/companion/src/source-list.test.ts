import { expect, test } from "bun:test";
import type { Source } from "@repo/kb-shared";
import { sourcePage } from "./source-list";
const sources = Array.from(
  { length: 2500 },
  (_, i) =>
    ({
      id: `video:${i}`,
      title: `Title ${i}`,
      channel: `Channel ${i % 5}`,
      publishedOn: `202${i % 5}-01-01`,
      status: i < 10 ? "deferred" : "ready_for_reflection",
    }) as Source,
);
test("bounded pages cover the full catalog, preserve order and search beyond the first page", () => {
  const all: string[] = [];
  for (let page = 1; page <= 50; page++) {
    const result = sourcePage(
      sources,
      new URLSearchParams({ tab: "all", page: String(page) }),
    );
    expect(result.total).toBe(2500);
    expect(result.counts).toEqual({ inbox: 2490, later: 10, all: 2500 });
    const videos = result.groups.flatMap((group) => group.videos);
    expect(videos).toHaveLength(50);
    all.push(...videos.map((video) => video.id));
  }
  expect(new Set(all).size).toBe(2500);
  const search = sourcePage(
    sources,
    new URLSearchParams({ tab: "all", q: "tle 2499" }),
  );
  expect(search.total).toBe(1);
  expect(search.groups[0].videos[0].id).toBe("video:2499");
  expect(
    sourcePage(sources, new URLSearchParams("tab=later&page=999")).page,
  ).toBe(1);
});
test("group boundaries paginate without losing channel totals or release ordering", () => {
  const first = sourcePage(
    sources,
    new URLSearchParams("tab=all&group=channel"),
  );
  expect(first.groups[0].label).toBe("Channel 0");
  expect(first.groups[0].total).toBe(500);
  expect(first.groups[0].videos).toHaveLength(50);
  const next = sourcePage(
    sources,
    new URLSearchParams("tab=all&group=channel&page=11"),
  );
  expect(next.groups[0].label).toBe("Channel 1");
  expect(() => sourcePage(sources, new URLSearchParams("page=-1"))).toThrow();
});
