/** Deterministic scale regression test: real HTTP, Markdown, SQLite and backfill;
 * no personal vault or external service is accessed. */
import { mkdtemp, mkdir, rm, realpath } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createCompanion } from "../apps/companion/src/index";
import { serializeMarkdown } from "../packages/kb/src/index";
import type { Source } from "@repo/kb-shared";

const sizes = (process.env.KB_PERF_SIZES ?? "2500,10000")
  .split(",")
  .map(Number);
if (sizes.some((size) => !Number.isInteger(size) || size < 100 || size > 30000))
  throw new Error("Use fixture sizes between 100 and 30000");
const budgets = {
  pageP95Ms: 250,
  detailP95Ms: 250,
  otherP95Ms: 150,
  writeP95Ms: 500,
  pageBytes: 128 * 1024,
  maxRows: 50,
  coldStartMs: 15000,
};
const reports = [];
const failures: string[] = [];
const percentile = (values: number[], p: number) =>
  [...values].sort((a, b) => a - b)[
    Math.max(0, Math.ceil(values.length * p) - 1)
  ] ?? 0;
for (const size of sizes) {
  const directory = await mkdtemp(
    join(await realpath(tmpdir()), "kb-performance-"),
  );
  const token = crypto.randomUUID();
  const videoId = (n: number) => `p${String(n).padStart(10, "0")}`;
  const fixture = (n: number): Source => ({
    id: `youtube:${videoId(n)}`,
    videoId: videoId(n),
    url: `https://www.youtube.com/watch?v=${videoId(n)}`,
    title: `Fixture video ${String(n).padStart(6, "0")} on memory`,
    channel: `Channel ${n % 100}`,
    channelUrl: `https://www.youtube.com/@fixture${n % 100}`,
    thumbnailUrl: `https://i.ytimg.com/vi/${videoId(n)}/mqdefault.jpg`,
    firstSeenAt: "2026-09-16T00:00:00Z",
    lastSeenAt: "2026-09-16T00:00:00Z",
    encounters: ["2026-09-16T00:00:00Z"],
    tags: [],
    status: "ready_for_reflection",
    transcriptStatus: "requires_user_action",
    ...(n % 2 === 0 ? { publishedOn: "2025-01-01" } : {}),
  });
  // Seed directly so fixture creation does not benchmark fsync once per source.
  for (let i = 0; i < size; i += 32)
    await Promise.all(
      Array.from({ length: Math.min(32, size - i) }, async (_, j) => {
        const source = fixture(i + j);
        const folder = join(directory, "sources/youtube", source.videoId);
        await mkdir(folder, { recursive: true });
        await Bun.write(
          join(folder, "source.md"),
          serializeMarkdown("source", source),
        );
      }),
    );
  const started = performance.now();
  const app = await createCompanion({
    vaultPath: directory,
    token,
    port: 0,
    media: {
      publication: async () => {
        await Bun.sleep(25);
        return "2025-01-01";
      },
      metadata: async () => {
        throw new Error("Unexpected metadata request");
      },
    },
  });
  const coldStartMs = performance.now() - started;
  const server = app.start();
  const base = `http://127.0.0.1:${server.port}`;
  const results: Record<
    string,
    { p50Ms: number; p95Ms: number; maxMs: number; maxBytes: number }
  > = {};
  async function request(path: string, method = "GET", body?: unknown) {
    const at = performance.now();
    const response = await fetch(`${base}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await response.text();
    if (!response.ok)
      throw new Error(`${method} ${path}: ${response.status} ${text}`);
    return {
      ms: performance.now() - at,
      bytes: Buffer.byteLength(text),
      data: JSON.parse(text),
    };
  }
  async function measure(
    name: string,
    work: (i: number) => ReturnType<typeof request>,
    budget: number,
    runs = 20,
  ) {
    const times = [];
    let bytes = 0;
    for (let i = 0; i < runs; i++) {
      const result = await work(i);
      times.push(result.ms);
      bytes = Math.max(bytes, result.bytes);
    }
    const p95 = percentile(times, 0.95);
    results[name] = {
      p50Ms: Math.round(percentile(times, 0.5) * 100) / 100,
      p95Ms: Math.round(p95 * 100) / 100,
      maxMs: Math.round(Math.max(...times) * 100) / 100,
      maxBytes: bytes,
    };
    if (p95 > budget)
      failures.push(`${size}: ${name} p95 ${p95.toFixed(1)}ms > ${budget}ms`);
  }
  try {
    const firstPage = await request("/sources/page?tab=all"); // starts concurrent backfill
    if (
      firstPage.data.groups.flatMap(
        (group: { videos: Source[] }) => group.videos,
      ).length > budgets.maxRows
    )
      failures.push(`${size}: unbounded page`);
    if (firstPage.data.total !== size)
      failures.push(`${size}: missing sources`);
    const before = app.vault.diagnostics();
    await measure(
      "videoPageDuringBackfill",
      (i) => request(`/sources/page?tab=all&page=${i + 1}`),
      budgets.pageP95Ms,
    );
    await measure(
      "groupedSearch",
      () => request("/sources/page?tab=all&group=channel&q=memory"),
      budgets.pageP95Ms,
    );
    await measure(
      "sourceDetailDuringBackfill",
      (i) => request(`/sources/youtube:${videoId(i)}`),
      budgets.detailP95Ms,
    );
    for (const path of [
      "knowledge",
      "proposals",
      "timeline",
      "search?q=memory",
      "metadata/status",
      "settings",
    ])
      await measure(path, () => request(`/${path}`), budgets.otherP95Ms, 10);
    await measure(
      "reflectionWriteDuringBackfill",
      (i) =>
        request(`/sources/youtube:${videoId(i)}/reflection`, "PUT", {
          why: "Performance fixture",
          reaction: "",
          questions: "",
          selectedPassages: [],
          decision: "later",
        }),
      budgets.writeP95Ms,
      10,
    );
    const after = app.vault.diagnostics();
    const metrics = (await request("/metrics")).data;
    if (metrics.metadata.completed < 1 || metrics.metadata.queued < 1)
      failures.push(`${size}: benchmark did not overlap an active backfill`);
    if (after.filesRead - before.filesRead > 2000)
      failures.push(
        `${size}: hot-path file reads scaled with the library (${after.filesRead - before.filesRead})`,
      );
    if (results.videoPageDuringBackfill.maxBytes > budgets.pageBytes)
      failures.push(`${size}: excessive page payload`);
    if (coldStartMs > budgets.coldStartMs)
      failures.push(
        `${size}: cold start ${coldStartMs.toFixed(0)}ms > ${budgets.coldStartMs}ms`,
      );
    reports.push({
      videos: size,
      coldStartMs: Math.round(coldStartMs),
      results,
      hotPathFileReads: after.filesRead - before.filesRead,
      metrics,
    });
    console.log(JSON.stringify(reports.at(-1), null, 2));
  } finally {
    server.stop(true);
    app.close();
    await Bun.sleep(100); // injected in-flight provider calls settle before fixture removal
    await rm(directory, { recursive: true, force: true });
  }
}
const output = resolve(".kb-local/performance/latest.json");
await mkdir(resolve(".kb-local/performance"), { recursive: true });
await Bun.write(
  output,
  JSON.stringify(
    {
      at: new Date().toISOString(),
      runtime: Bun.version,
      budgets,
      reports,
      failures,
    },
    null,
    2,
  ),
);
console.log(`Performance report: ${output}`);
if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
