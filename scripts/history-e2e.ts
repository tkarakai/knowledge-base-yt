/** Real MV3 extension, browser DOM pagination, companion HTTP and Markdown vault.
 * YouTube pages are fixtures; no Google account or personal history is accessed. */
import { chromium, expect, type BrowserContext } from "@playwright/test";
import { mkdtemp, realpath, rm, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createCompanion } from "../apps/companion/src/index";
import { localDay, twelveMonthsAgo } from "../apps/extension/src/history";

const root = resolve(import.meta.dir, "..");
const temp = await mkdtemp(join(await realpath(tmpdir()), "history-e2e-"));
const screenshots = join(root, ".kb-local", "history-e2e");
await mkdir(screenshots, { recursive: true });
const master = crypto.randomUUID();
const app = await createCompanion({
  vaultPath: join(temp, "vault"),
  token: master,
  media: { background: false },
});
let dropped = false;
// Simulate a lost acknowledgement after the first successful durable write.
const server = Bun.serve({
  hostname: "127.0.0.1",
  port: 0,
  async fetch(request) {
    const url = new URL(request.url);
    url.port = "4317";
    const headers = new Headers(request.headers);
    headers.set("host", "127.0.0.1:4317");
    const response = await app.fetch(
      new Request(url, {
        method: request.method,
        headers,
        body: ["GET", "HEAD"].includes(request.method)
          ? undefined
          : await request.arrayBuffer(),
      }),
    );
    if (url.pathname === "/history/batches" && response.ok && !dropped) {
      dropped = true;
      return Response.json(
        { error: "Fixture: connection lost after saving. Resume to retry." },
        { status: 503 },
      );
    }
    return response;
  },
});
let context: BrowserContext | undefined;
try {
  const dist = join(root, "apps/extension/dist");
  context = await chromium.launchPersistentContext(join(temp, "browser"), {
    channel: "chromium",
    headless: true,
    args: [`--disable-extensions-except=${dist}`, `--load-extension=${dist}`],
  });
  const worker =
    context.serviceWorkers()[0] ??
    (await context.waitForEvent("serviceworker"));
  const extensionId = new URL(worker.url()).host;
  const through = localDay(),
    cutoff = twelveMonthsAgo(through);
  const before = new Date(Date.parse(cutoff) - 86400000)
    .toISOString()
    .slice(0, 10);
  const id = (i: number) => `vid${String(i).padStart(8, "0")}`;
  const section = (day: string, start: number, count: number) =>
    `<ytd-item-section-renderer><div id="header"><ytd-item-section-header-renderer><h2 id="title">${day}</h2></ytd-item-section-header-renderer></div>${Array.from({ length: count }, (_, n) => `<ytd-video-renderer style="display:block;height:30px"><a id="video-title" href="/watch?v=${id(start + n)}">History video ${start + n}</a><span id="channel-name"><a href="/@fixture">Fixture channel</a></span><img src="https://i.ytimg.com/vi/${id(start + n)}/mqdefault.jpg"><a href="/@fixture"><img src="https://yt3.ggpht.com/fixture-avatar"></a></ytd-video-renderer>`).join("")}</ytd-item-section-renderer>`;
  const pages = [
    section(through, 0, 105),
    section(cutoff, 105, 106),
    section(before, 211, 3),
  ];
  const fixture = `<!doctype html><html lang="en"><body><ytd-browse page-subtype="history"><div id="history-contents"></div><ytd-continuation-item-renderer><button>Load older history</button></ytd-continuation-item-renderer></ytd-browse><script>
    const pages = ${JSON.stringify(pages)}; let index = 0;
    const contents = document.getElementById('history-contents');
    function load(){ contents.insertAdjacentHTML('beforeend',pages[index++]); if(index===pages.length)document.querySelector('ytd-continuation-item-renderer').remove(); }
    document.querySelector('button').onclick=()=>{document.querySelector('button').disabled=true;setTimeout(()=>{load(); const button=document.querySelector('button'); if(button)button.disabled=false;},300)};
    load();
  </script></body></html>`;
  await context.route("https://i.ytimg.com/**", (route) => route.abort());
  await context.route("https://yt3.ggpht.com/**", (route) => route.abort());
  let fixtureBody = fixture;
  await context.route("https://www.youtube.com/**", (route) =>
    route.fulfill({ contentType: "text/html", body: fixtureBody }),
  );
  const panel = await context.newPage();
  await panel.goto(`chrome-extension://${extensionId}/panel.html`);
  const issue = await app.fetch(
    new Request("http://127.0.0.1:4317/history/pair-code", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${master}`,
        "Content-Type": "application/json",
      },
      body: "{}",
    }),
  );
  const { code } = await issue.json();
  await panel
    .getByLabel("Companion address")
    .fill(`http://127.0.0.1:${server.port}`);
  await panel.getByLabel("One-time pairing code").fill(code);
  await panel.getByRole("button", { name: "Connect Commonplace" }).click();
  await expect(
    panel.getByRole("heading", { name: "Workspace connected" }),
  ).toBeVisible();
  const opened = context.waitForEvent("page");
  await panel.getByRole("button", { name: "Open YouTube history" }).click();
  const history = await opened;
  // Explicit navigation also makes interception deterministic for extension-created tabs.
  await history.goto("https://www.youtube.com/feed/history?hl=en");
  await expect(
    history.locator('ytd-browse[page-subtype="history"]'),
  ).toBeAttached();
  await panel
    .getByRole("button", { name: "Import last 12 months", exact: true })
    .click();
  await expect(panel.locator("#run-status")).toHaveText(
    "PARTIAL IMPORT / PAUSED",
    { timeout: 30000 },
  );
  expect((await app.vault.listSources()).length).toBe(100);
  await panel
    .getByRole("button", { name: "Resume import", exact: true })
    .click();
  await expect(panel.locator("#run-status")).toHaveText("COMPLETE", {
    timeout: 60000,
  });
  await expect(panel.locator("#counts")).toHaveText(
    "211 added · 0 already known",
  );
  expect(await app.vault.listSources()).toHaveLength(211);
  const harvested = (await app.vault.getSource(`youtube:${id(0)}`))!;
  expect(harvested.thumbnailUrl).toBe(
    `https://i.ytimg.com/vi/${id(0)}/mqdefault.jpg`,
  );
  expect(harvested.channelAvatarUrl).toBe(
    "https://yt3.ggpht.com/fixture-avatar",
  );
  expect(harvested.channelUrl).toBe("https://www.youtube.com/@fixture");
  expect(await app.vault.getSource(`youtube:${id(211)}`)).toBeNull();
  expect(
    (await app.vault.getSource(`youtube:${id(210)}`))!.history?.watchedOn,
  ).toBe(cutoff);
  const ignored = (await app.vault.getSource(`youtube:${id(0)}`))!;
  ignored.status = "ignored";
  await app.vault.saveSource(ignored);
  await panel
    .getByRole("button", { name: "Start a new 12-month sync" })
    .click();
  await expect(panel.locator("#counts")).toHaveText(
    "0 added · 211 already known",
    { timeout: 30000 },
  );
  await expect(panel.locator("#run-status")).toHaveText("COMPLETE");
  expect(await app.vault.getSource(ignored.id)).toEqual(ignored);
  await panel.screenshot({
    path: join(screenshots, "import-complete.png"),
    fullPage: true,
  });
  // Unrecognized date must pause, never claim a complete 12-month import.
  fixtureBody = fixture.replaceAll(through, "Unknown date");
  await panel
    .getByRole("button", { name: "Start a new 12-month sync" })
    .click();
  await expect(panel.locator("#run-status")).toHaveText(
    "PARTIAL IMPORT / PAUSED",
  );
  await expect(panel.locator("#reason")).toContainText("Cannot safely read");
  await panel.screenshot({
    path: join(screenshots, "partial-import.png"),
    fullPage: true,
  });
  // A short history without any continuation can finish before the cutoff.
  fixtureBody = `<!doctype html><html><body><ytd-browse page-subtype="history">${section(through, 0, 2)}</ytd-browse></body></html>`;
  await panel
    .getByRole("button", { name: "Start a new 12-month sync" })
    .click();
  await expect(panel.locator("#run-status")).toHaveText("COMPLETE", {
    timeout: 20000,
  });
  await expect(panel.locator("#reason")).toContainText(
    "end of the available history",
  );
  // An unresponsive continuation must remain partial, not be mistaken for end-of-feed.
  fixtureBody = `<!doctype html><html><body><ytd-browse page-subtype="history">${section(through, 0, 2)}<ytd-continuation-item-renderer><button disabled>Loading older history</button></ytd-continuation-item-renderer></ytd-browse></body></html>`;
  await panel
    .getByRole("button", { name: "Start a new 12-month sync" })
    .click();
  await expect(panel.locator("#run-status")).toHaveText(
    "PARTIAL IMPORT / PAUSED",
    { timeout: 55000 },
  );
  await expect(panel.locator("#reason")).toContainText(
    "stopped loading older history",
  );
  console.log(
    `PASS: MV3 pairing → 211 videos over paginated 12-month window → lost acknowledgement/replay → deduplication/decisions → unknown-date pause → end-of-feed → stalled pagination. Screenshots: ${screenshots}`,
  );
} catch (error) {
  for (const page of context?.pages() ?? []) {
    console.error("Fixture page:", page.url());
    if (page.url().startsWith("chrome-extension://")) {
      console.error(await page.locator("body").innerText());
      await page.screenshot({
        path: join(screenshots, "failure.png"),
        fullPage: true,
      });
    }
  }
  throw error;
} finally {
  await context?.close();
  server.stop(true);
  app.close();
  await rm(temp, { recursive: true, force: true });
}
