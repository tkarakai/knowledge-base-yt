/** End-to-end acceptance fixture. Real browser, Next proxy, companion, vault and Pi;
 * only external YouTube/model servers are replaced by deterministic local providers. */
import { chromium, expect } from "@playwright/test";
import { experienceJourney } from "../apps/web/qa/e2e/kb-ux-journey";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { serializeMarkdown } from "../packages/kb/src/index";
import { createCompanion } from "../apps/companion/src/index";

const root = resolve(import.meta.dir, "..");
const directory = await mkdtemp(
  join(
    await import("node:fs/promises").then((fs) => fs.realpath(tmpdir())),
    "kb-e2e-",
  ),
);
const token = crypto.randomUUID() + crypto.randomUUID();
const sourceId = "youtube:dQw4w9WgXcQ";
let modelCalls = 0;
const proposal = {
  summary: "Durable local memory",
  whyItMatters: "Separates durable notes from derived indexes",
  outcome: "changes",
  changes: [
    {
      operation: "create_note",
      knowledgeId: "knowledge:durable-memory",
      title: "Durable memory",
      before: "",
      after: "# Durable memory\n\nMarkdown keeps knowledge portable.",
      rationale: "The selected passage supports portable knowledge",
      evidence: [
        {
          sourceId,
          start: 0,
          end: 12,
          quote: "Markdown keeps knowledge portable.",
        },
      ],
    },
    {
      operation: "create_note",
      knowledgeId: "knowledge:derived-indexes",
      title: "Derived indexes",
      before: "",
      after: "# Derived indexes\n\nSearch indexes can be rebuilt.",
      rationale: "A separate useful idea for review",
      evidence: [
        {
          sourceId,
          start: 12,
          end: 24,
          quote: "Search indexes can be rebuilt.",
        },
      ],
    },
  ],
  questions: [],
};
const model = Bun.serve({
  hostname: "127.0.0.1",
  port: 0,
  async fetch(request) {
    if (new URL(request.url).pathname !== "/v1/chat/completions")
      return new Response("Not found", { status: 404 });
    const payload = (await request.json()) as {
      tools: { function: { name: string } }[];
    };
    expect(payload.tools.map((t) => t.function.name)).not.toContain("shell");
    const tool =
      modelCalls++ % 2 === 0
        ? { name: "source_read", args: {} }
        : { name: "submit_synthesis", args: proposal };
    const chunk = (delta: unknown, finish: string | null) =>
      `data: ${JSON.stringify({ id: "fixture", object: "chat.completion.chunk", model: "fixture-model", choices: [{ index: 0, delta, finish_reason: finish }] })}\n\n`;
    return new Response(
      chunk(
        {
          role: "assistant",
          tool_calls: [
            {
              index: 0,
              id: `call_${modelCalls}`,
              type: "function",
              function: {
                name: tool.name,
                arguments: JSON.stringify(tool.args),
              },
            },
          ],
        },
        null,
      ) +
        chunk({}, "tool_calls") +
        "data: [DONE]\n\n",
      { headers: { "Content-Type": "text/event-stream" } },
    );
  },
});
const options = {
  vaultPath: join(directory, "vault"),
  token,
  port: 0,
  media: {
    publication: async () => "2024-03-12",
    channelAvatar: async () => "https://yt3.ggpht.com/fixture-avatar",
    fetch: (async () =>
      new Response(
        await Bun.file(
          join(root, "packages/design-system/assets/apple-touch-icon.png"),
        ).arrayBuffer(),
        { headers: { "Content-Type": "image/png" } },
      )) as typeof fetch,
  },
  metadata: async (videoId: string) => ({
    videoId,
    url: `https://www.youtube.com/watch?v=${videoId}`,
    title: "Building a memory that lasts",
    channel: "Local fixture",
    channelUrl: "https://www.youtube.com/@fixture",
    thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`,
  }),
  transcriptProvider: {
    fetch: async () => ({
      sourceId,
      language: "en",
      provider: "fixture",
      generated: false,
      status: "available" as const,
      segments: [
        { start: 0, end: 12, text: "Markdown keeps knowledge portable." },
        { start: 12, end: 24, text: "Search indexes can be rebuilt." },
      ],
    }),
  },
};
let app = await createCompanion(options);
let server = app.start();
await app.state.update({
  inference: {
    baseUrl: `http://127.0.0.1:${model.port}/v1`,
    model: "fixture-model",
  },
  network: { youtube: true, inference: true, embeddings: false },
});
const reserve = Bun.serve({
  hostname: "127.0.0.1",
  port: 0,
  fetch: () => new Response(),
});
const webPort = reserve.port!;
reserve.stop(true);
const base = `http://127.0.0.1:${webPort}`;
const logPath = join(directory, "next.log");
const logFile = Bun.file(logPath);
const web = Bun.spawn(
  [
    process.execPath,
    "node_modules/next/dist/bin/next",
    process.env.KB_E2E_PRODUCTION === "1" ? "start" : "dev",
    "--hostname",
    "127.0.0.1",
    "--port",
    String(webPort),
  ],
  {
    cwd: join(root, "apps/web"),
    env: {
      ...process.env,
      KB_COMPANION_TOKEN: token,
      KB_COMPANION_URL: `http://127.0.0.1:${server.port}`,
      NEXT_PUBLIC_SITE_URL: base,
    },
    stdout: logFile,
    stderr: logFile,
  },
);
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
const screenshots = join(root, ".kb-local", "qa");
await mkdir(screenshots, { recursive: true });
try {
  let ready = false;
  for (let i = 0; i < 120; i++) {
    if (web.exitCode !== null)
      throw new Error(`Next exited; inspect ${logPath}`);
    try {
      if (
        (await fetch(`${base}/kb`, { signal: AbortSignal.timeout(1500) })).ok
      ) {
        ready = true;
        break;
      }
    } catch {
      /* starting */
    }
    await Bun.sleep(500);
  }
  if (!ready)
    throw new Error(`Next failed to become ready; inspect ${logPath}`);
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1050 },
  });
  const page = await context.newPage();
  const browserErrors: string[] = [];
  page.on("pageerror", (error) => browserErrors.push(error.message));
  await page.goto(`${base}/kb`);
  await expect(
    page.getByRole("heading", { name: "The reflection inbox" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "A clear desk. An open mind." }),
  ).toBeVisible();
  await page.screenshot({
    path: join(screenshots, "inbox.png"),
    fullPage: true,
  });
  await page
    .getByLabel("What have you been watching?", { exact: false })
    .fill("https://youtu.be/dQw4w9WgXcQ");
  await page.getByRole("button", { name: "Add to inbox" }).click();
  await expect(
    page.getByRole("heading", { name: "Building a memory that lasts" }),
  ).toBeVisible({ timeout: 15000 });
  await page.getByRole("checkbox", { name: "Select passage at 0:00" }).check();
  await page.getByRole("checkbox", { name: "Select passage at 0:12" }).check();
  await page
    .getByLabel("Why is it worth keeping?")
    .fill("This clarified why my notes should outlive the app.");
  await page.getByRole("button", { name: "Save reflection" }).click();
  await expect(
    page.getByRole("button", { name: "Propose connections" }),
  ).toBeEnabled();
  await page.reload();
  await expect(
    page.getByRole("checkbox", { name: "Select passage at 0:12" }),
  ).toBeChecked();
  await page.screenshot({
    path: join(screenshots, "reflection.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Propose connections" }).click();
  await expect(
    page.getByRole("heading", { name: "Durable local memory" }),
  ).toBeVisible({ timeout: 15000 });
  expect(await app.vault.listKnowledge()).toEqual([]);
  const first = page.getByRole("region", { name: "Change 1: Durable memory" });
  const second = page.getByRole("region", {
    name: "Change 2: Derived indexes",
  });
  await first.getByRole("button", { name: "Edit Markdown" }).click();
  await first
    .getByLabel("Proposed Markdown · editable")
    .fill(
      "# Durable memory\n\nMarkdown keeps knowledge portable. My reviewed wording.",
    );
  await first.getByRole("radio", { name: "Accept change" }).check();
  await second.getByRole("radio", { name: "Reject change" }).check();
  await page.screenshot({
    path: join(screenshots, "review.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Apply selected decisions" }).click();
  await expect
    .poll(async () => (await app.vault.listKnowledge()).length)
    .toBe(1);
  const note = (await app.vault.listKnowledge())[0]!;
  expect(note.markdown).toContain("My reviewed wording.");
  expect(note.markdown).toContain("&t=0s");
  expect(await app.vault.getKnowledge("knowledge:derived-indexes")).toBeNull();
  await expect
    .poll(async () => (await app.vault.listProposals())[0]!.status)
    .toBe("partially_accepted");
  await page.goto(`${base}/kb/knowledge/${encodeURIComponent(note.id)}`);
  await expect(
    page.getByRole("heading", { name: "Durable memory", exact: true }).first(),
  ).toBeVisible();
  await page.screenshot({
    path: join(screenshots, "knowledge.png"),
    fullPage: true,
  });
  await page.goto(`${base}/kb/search`);
  await page.getByLabel("Search your knowledge").fill("portable");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(
    page.getByRole("link", { name: "Durable memory", exact: false }).first(),
  ).toBeVisible();
  await page.screenshot({
    path: join(screenshots, "search.png"),
    fullPage: true,
  });
  await page.goto(`${base}/kb/knowledge`);
  await page.getByRole("button", { name: "Import Markdown" }).click();
  await page.getByLabel("Document title").fill("Archive notebook");
  await page
    .getByLabel("Markdown content")
    .fill(
      "# Archive notebook\n\nA document about archival portability and personal memory.",
    );
  await page.getByRole("button", { name: "Import document" }).click();
  await expect(
    page.getByText("Document imported and available in search.", {
      exact: false,
    }),
  ).toBeVisible();
  await page.goto(`${base}/kb/search`);
  await page.getByLabel("Search your knowledge").fill("archival");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await page
    .getByRole("link", { name: "Archive notebook", exact: false })
    .click();
  await expect(
    page.getByText(
      "A document about archival portability and personal memory.",
      { exact: true },
    ),
  ).toBeVisible();
  const searchResponse = await page.request.get(
    `${base}/api/kb/search?q=portable`,
  );
  expect(searchResponse.ok()).toBe(true);
  expect(
    (await searchResponse.json()).some(
      (hit: { id: string }) => hit.id === note.id,
    ),
  ).toBe(true);
  const foreign = await fetch(`${base}/api/kb/sources`, {
    headers: { origin: "https://untrusted.example" },
  });
  expect(foreign.status).toBe(403);
  const healthText = await (
    await page.request.get(`${base}/api/kb/health`)
  ).text();
  expect(healthText).not.toContain(token);
  await page.goto(`${base}/kb/settings#youtube-history`);
  await page
    .getByRole("button", { name: "Generate pairing code", exact: true })
    .click();
  await expect(page.getByLabel("One-time pairing code")).toHaveValue(
    /^[a-f0-9]{36}$/,
  );
  const code = await page.getByLabel("One-time pairing code").inputValue();
  const paired = await fetch(`http://127.0.0.1:${server.port}/history/pair`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-KB-Extension-Id": "a".repeat(32),
    },
    body: JSON.stringify({ code }),
  });
  expect(paired.ok).toBe(true);
  await page
    .locator("#youtube-history")
    .getByRole("button", { name: "Check connection" })
    .click();
  await expect(
    page.getByText("History extension connected", { exact: true }),
  ).toBeVisible();
  await page
    .locator("#youtube-history")
    .screenshot({ path: join(screenshots, "history-settings.png") });
  await page.getByRole("button", { name: "Disconnect", exact: true }).click();
  await expect(
    page.getByText("Connect the Commonplace history extension", {
      exact: true,
    }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .locator("#youtube-history")
    .screenshot({ path: join(screenshots, "history-settings-mobile.png") });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByText("Show performance metrics", { exact: true }).click();
  await expect(
    page.getByRole("columnheader", { name: "p95", exact: true }),
  ).toBeVisible();
  await page
    .locator(".kb-settings-section")
    .filter({
      has: page.getByRole("heading", { name: "Performance", exact: true }),
    })
    .screenshot({ path: join(screenshots, "performance-settings-mobile.png") });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.goto(`${base}/kb`);
  await page.screenshot({
    path: join(screenshots, "mobile.png"),
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  expect(browserErrors).toEqual([]);
  // Every video tab shares release sorting, channel grouping, and substring filtering.
  const original = (await app.vault.getSource(sourceId))!;
  for (const [videoId, title, channel, publishedOn, status] of [
    [
      "AAAAAAAAAAA",
      "Archive methods",
      "Alpha lab",
      "2020-01-10",
      "ready_for_reflection",
    ],
    [
      "BBBBBBBBBBB",
      "Modern methods",
      "Alpha lab",
      "2024-05-20",
      "ready_for_reflection",
    ],
    [
      "CCCCCCCCCCC",
      "Fresh perspective",
      "Beta lab",
      "2026-08-15",
      "ready_for_reflection",
    ],
    ["DDDDDDDDDDD", "For a quieter day", "Beta lab", "2019-06-01", "deferred"],
  ] as const)
    await app.vault.saveSource({
      ...original,
      id: `youtube:${videoId}`,
      videoId,
      url: `https://www.youtube.com/watch?v=${videoId}`,
      title,
      channel,
      channelUrl: `https://www.youtube.com/@${channel.startsWith("Alpha") ? "alpha" : "beta"}`,
      publishedOn,
      status,
      thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`,
      thumbnailPath: undefined,
      channelAvatarPath: undefined,
    });
  await page.setViewportSize({ width: 1440, height: 1050 });
  await page.goto(`${base}/kb`);
  await expect(page.locator(".kb-source-summary h2")).toHaveText([
    "Fresh perspective",
    "Modern methods",
    "Archive methods",
  ]);
  await expect(page.locator(".kb-release-date").first()).toHaveText(
    "Released Aug 15, 2026",
  );
  await page.getByLabel("Group by channel").check();
  await expect(
    page
      .locator(".kb-video-group-section")
      .first()
      .locator(".kb-source-summary h2"),
  ).toHaveText(["Modern methods", "Archive methods"]);
  await page.getByLabel("Find a video").fill("aLpHa");
  await expect(page.locator(".kb-source-summary h2")).toHaveText([
    "Modern methods",
    "Archive methods",
  ]);
  await page.getByLabel("Find a video").fill("chive met");
  await expect(page.locator(".kb-source-summary h2")).toHaveText([
    "Archive methods",
  ]);
  await page.getByLabel("Find a video").fill("");
  await page
    .getByRole("group", { name: "Filter sources" })
    .getByRole("button", { name: "For later", exact: false })
    .click();
  await expect(page.locator(".kb-source-summary h2")).toHaveText([
    "For a quieter day",
  ]);
  await page.getByRole("button", { name: "All sources", exact: false }).click();
  await expect(page.locator(".kb-source-row")).toHaveCount(5);
  await expect(page.locator(".kb-video-thumbnail img")).toHaveCount(5);
  await expect(
    page.locator(".kb-source-row .kb-channel-avatar img"),
  ).toHaveCount(5);
  await expect
    .poll(() =>
      page
        .locator(".kb-video-thumbnail img")
        .evaluateAll((images) =>
          images.every((image) => (image as HTMLImageElement).naturalWidth > 0),
        ),
    )
    .toBe(true);
  await expect
    .poll(() =>
      page
        .locator(".kb-channel-avatar img")
        .evaluateAll((images) =>
          images.every((image) => (image as HTMLImageElement).naturalWidth > 0),
        ),
    )
    .toBe(true);
  // Progress is independent of tab/search and represents metadata, not lazy images.
  let progressFixture = {
    enabled: true,
    total: 2100,
    completed: 630,
    incomplete: 4,
    active: 2,
    queued: 1468,
    estimatedRemainingSeconds: 480,
  };
  let retries = 0;
  await page.route("**/api/kb/metadata/status", (route) =>
    route.fulfill({ json: progressFixture }),
  );
  await page.route("**/api/kb/metadata/refresh", (route) => {
    retries++;
    return route.fulfill({ json: progressFixture });
  });
  const progressPanel = page.getByRole("region", {
    name: "Video details progress",
  });
  await expect(progressPanel).toContainText("630 of 2,100 checked · 30%");
  await expect(progressPanel).toContainText(
    "2 loading · 1,468 queued · About 8 minutes remaining",
  );
  await expect(progressPanel.locator(".kb-spin")).toHaveCount(1);
  await expect(
    page.getByRole("progressbar", { name: "Video detail checks" }),
  ).toHaveAttribute("value", "630");
  await expect(
    page.getByRole("button", { name: "Retry missing details" }),
  ).toBeDisabled();
  progressFixture = {
    ...progressFixture,
    completed: 2100,
    active: 0,
    queued: 0,
  };
  await expect(progressPanel).toContainText("Video detail checks finished");
  await expect(progressPanel).toContainText(
    "4 checked videos still have missing details",
  );
  await page.getByRole("button", { name: "Retry missing details" }).click();
  await expect.poll(() => retries).toBe(1);
  progressFixture = {
    ...progressFixture,
    completed: 630,
    active: 2,
    queued: 1468,
  };
  await expect(progressPanel).toContainText("Getting video details");
  await page.screenshot({
    path: join(screenshots, "videos-grouped.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: join(screenshots, "videos-grouped-mobile.png"),
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  if (process.env.KB_PERF_BROWSER === "1") {
    const results = [];
    let seeded = 0;
    await page.unroute("**/api/kb/metadata/status");
    await page.unroute("**/api/kb/metadata/refresh");
    await page.setViewportSize({ width: 1440, height: 1050 });
    for (const size of [2500, 10000]) {
      for (let i = seeded; i < size; i += 32)
        await Promise.all(
          Array.from({ length: Math.min(32, size - i) }, async (_, j) => {
            const videoId = `s${String(i + j).padStart(10, "0")}`;
            const fixture = {
              ...original,
              id: `youtube:${videoId}`,
              videoId,
              url: `https://www.youtube.com/watch?v=${videoId}`,
              title: `Scale fixture ${String(i + j).padStart(5, "0")}`,
              status: "ready_for_reflection",
              channel: `Scale channel ${(i + j) % 100}`,
              channelUrl: `https://www.youtube.com/@scale${(i + j) % 100}`,
            };
            const folder = join(options.vaultPath, "sources/youtube", videoId);
            await mkdir(folder, { recursive: true });
            await Bun.write(
              join(folder, "source.md"),
              serializeMarkdown("source", fixture),
            );
          }),
        );
      seeded = size;
      await app.vault.refresh();
      const started = performance.now();
      await page.goto(`${base}/kb`);
      await expect(page.locator(".kb-source-row")).toHaveCount(50);
      const firstPageMs = performance.now() - started;
      const nextTimes = [],
        searchTimes = [];
      for (let run = 0; run < 5; run++) {
        const nextStart = performance.now();
        await page.getByRole("button", { name: "Next", exact: true }).click();
        await expect(page.locator(".kb-video-pagination")).toContainText(
          `Page ${run + 2} of`,
        );
        nextTimes.push(performance.now() - nextStart);
        await expect(page.locator(".kb-source-row")).toHaveCount(50);
      }
      for (let run = 0; run < 5; run++) {
        const searchStart = performance.now();
        await page
          .getByLabel("Find a video")
          .fill(`fixture ${String(size - 1 - run).padStart(5, "0")}`);
        await expect(page.locator(".kb-source-summary h2")).toHaveText([
          `Scale fixture ${String(size - 1 - run).padStart(5, "0")}`,
        ]);
        searchTimes.push(performance.now() - searchStart);
      }
      const summarize = (samples: number[]) => {
        const sorted = [...samples].sort((a, b) => a - b);
        return {
          samples: sorted.length,
          p50Ms: sorted[Math.floor(sorted.length / 2)],
          p95Ms: sorted[Math.ceil(sorted.length * 0.95) - 1],
        };
      };
      expect(firstPageMs).toBeLessThan(3000);
      expect(Math.max(...nextTimes)).toBeLessThan(1500);
      expect(Math.max(...searchTimes)).toBeLessThan(1500);
      results.push({
        videos: size + 5,
        firstPageMs,
        nextPage: summarize(nextTimes),
        search: summarize(searchTimes),
        maxRenderedRows: 50,
      });
    }
    await mkdir(join(root, ".kb-local/performance"), { recursive: true });
    await Bun.write(
      join(root, ".kb-local/performance/browser.json"),
      JSON.stringify(
        {
          at: new Date().toISOString(),
          runtime: `Next ${process.env.KB_E2E_PRODUCTION === "1" ? "production" : "dev"} + headless Chromium`,
          results,
        },
        null,
        2,
      ),
    );
    console.log("Browser performance:", JSON.stringify(results));
  }
  await experienceJourney({
    page,
    base,
    screenshots,
    prepare: (concept) => {
      proposal.summary = `${concept} connections`;
      proposal.changes[0].knowledgeId = `knowledge:ux-${concept}`;
      proposal.changes[0].title = `${concept} memory`;
      proposal.changes[1].knowledgeId = `knowledge:ux-${concept}-indexes`;
    },
  });
  expect(browserErrors).toEqual([]);
  // Restart and destroy the derived index: Markdown still contains the reviewed result.
  server.stop(true);
  app.close();
  for (const suffix of ["", "-wal", "-shm"])
    await rm(join(options.vaultPath, ".kb", `search.sqlite${suffix}`), {
      force: true,
    });
  app = await createCompanion(options);
  server = app.start();
  expect(
    (await app.vault.getReflection(sourceId))!.selectedPassages,
  ).toHaveLength(2);
  expect((await app.vault.getKnowledge(note.id))!.markdown).toContain(
    "My reviewed wording.",
  );
  expect(
    (await app.index.search("portable")).some((hit) => hit.id === note.id),
  ).toBe(true);
  console.log(
    `PASS: browser capture → reflection → Pi synthesis → edit/accept/reject → search → restart/rebuild. ${modelCalls} real Pi HTTP requests. Screenshots: ${screenshots}`,
  );
} catch (error) {
  console.error(`E2E diagnostics: ${logPath}`);
  console.error((await logFile.text()).slice(-5000));
  throw error;
} finally {
  await browser?.close();
  web.kill("SIGTERM");
  await web.exited;
  server.stop(true);
  app.close();
  model.stop(true);
}
