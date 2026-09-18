import { afterEach, expect, test } from "bun:test";
import { mkdtemp, realpath, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createCompanion } from "./index";
import type { Source } from "@repo/kb-shared";
import { youtubeChannelUrl, youtubeImageUrl } from "@repo/kb-shared";

const token = "media-test-token-local-server-only";
const image = new Uint8Array(
  await Bun.file(
    new URL(
      "../../../packages/design-system/assets/apple-touch-icon.png",
      import.meta.url,
    ),
  ).arrayBuffer(),
);
const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) await cleanup();
});
const source: Source = {
  id: "youtube:dQw4w9WgXcQ",
  videoId: "dQw4w9WgXcQ",
  url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  title: "A video",
  channel: "",
  firstSeenAt: "2026-09-16T12:00:00Z",
  lastSeenAt: "2026-09-16T12:00:00Z",
  status: "ignored",
  transcriptStatus: "requires_user_action",
  encounters: ["2026-09-16T12:00:00Z"],
  tags: [],
  history: { provider: "youtube-history", watchedOn: "2026-09-15" },
};
async function setup(
  media: NonNullable<Parameters<typeof createCompanion>[0]["media"]>,
) {
  const root = await mkdtemp(join(await realpath(tmpdir()), "media-test-"));
  const app = await createCompanion({
    vaultPath: root,
    token,
    media: { background: false, ...media },
  });
  await app.vault.saveSource(source);
  cleanups.push(async () => {
    app.close();
    await rm(root, { recursive: true, force: true });
  });
  const get = (path: string) =>
    app.fetch(
      new Request(`http://127.0.0.1:4317${path}`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
    );
  return { app, root, get };
}
test("saved thumbnail and channel avatar survive offline use without changing decisions", async () => {
  const calls: string[] = [];
  const { app, get } = await setup({
    fetch: (async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      calls.push(url);
      expect(init?.redirect).toBe("error");
      if (url.includes("/oembed"))
        return Response.json({
          title: "A video",
          author_name: "Research channel",
          author_url: "https://www.youtube.com/@research",
        });
      if (url === "https://www.youtube.com/@research")
        return new Response(
          '<meta content="https://yt3.ggpht.com/channel-avatar" property="og:image">',
        );
      return new Response(image, { headers: { "content-type": "image/png" } });
    }) as typeof fetch,
  });
  for (const kind of ["thumbnail", "avatar"]) {
    const response = await get(`/sources/${source.id}/media/${kind}`);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(image);
  }
  const updated = (await app.vault.getSource(source.id))!;
  expect(updated.channel).toBe("Research channel");
  expect(updated.channelUrl).toBe("https://www.youtube.com/@research");
  expect(updated.thumbnailPath).toMatch(/^assets\/[a-f0-9]{64}\.png$/);
  expect(updated.channelAvatarPath).toBe(updated.thumbnailPath);
  expect(updated.status).toBe("ignored");
  expect(updated.encounters).toEqual(source.encounters);
  const count = calls.length;
  await app.state.update({ network: { youtube: false } });
  expect((await get(`/sources/${source.id}/media/thumbnail`)).status).toBe(200);
  expect((await get(`/sources/${source.id}/media/avatar`)).status).toBe(200);
  expect(calls).toHaveLength(count);
});
test("unsupported bytes, excessive images, disallowed hosts and unsafe paths cannot be served", async () => {
  let payload = new TextEncoder().encode(
    "<svg><script>alert(1)</script></svg>",
  );
  const { app, get, root } = await setup({
    fetch: (async (_input: string | URL | Request) =>
      new Response(payload, {
        headers: { "content-type": "image/png" },
      })) as typeof fetch,
  });
  expect((await get(`/sources/${source.id}/media/thumbnail`)).status).toBe(415);
  payload = new Uint8Array(1024 * 1024 + 1);
  expect((await get(`/sources/${source.id}/media/thumbnail`)).status).toBe(413);
  for (const url of [
    "http://i.ytimg.com/a.jpg",
    "https://i.ytimg.com.evil.test/a.jpg",
    "https://user@i.ytimg.com/a.jpg",
    "https://127.0.0.1/image",
    "https://i.ytimg.com:444/a.jpg",
  ])
    expect(youtubeImageUrl(url, "thumbnail")).toBeUndefined();
  expect(
    youtubeChannelUrl("https://youtube.com.evil.test/@channel"),
  ).toBeUndefined();
  expect(
    youtubeChannelUrl("https://www.youtube.com/watch?v=abc"),
  ).toBeUndefined();
  await expect(app.vault.readImage("../../secret.png")).rejects.toThrow();
  const path = `assets/${"f".repeat(64)}.png`;
  await app.vault.saveImage(image, "png");
  await symlink(join(root, ".kb/settings.json"), join(root, path));
  await expect(app.vault.readImage(path)).rejects.toThrow();
});
test("release-date backfill preserves a decision made while metadata is loading", async () => {
  let publish!: (day: string) => void;
  const publication = new Promise<string>((resolve) => {
    publish = resolve;
  });
  const { app, get } = await setup({
    background: true,
    metadata: async (videoId) => ({
      videoId,
      url: source.url,
      title: source.title,
      channel: "Research channel",
    }),
    publication: async () => publication,
  });
  await get("/sources");
  const current = (await app.vault.getSource(source.id))!;
  current.status = "kept";
  await app.vault.saveSource(current);
  publish("2020-05-06");
  for (let i = 0; i < 100; i++) {
    const status = await (await get("/metadata/status")).json();
    if (status.active === 0 && status.queued === 0) break;
    await Bun.sleep(5);
  }
  const result = (await app.vault.getSource(source.id))!;
  expect(result.publishedOn).toBe("2020-05-06");
  expect(result.status).toBe("kept");
  expect(result.encounters).toEqual(source.encounters);
  expect(result.history).toEqual(source.history);
});

test("progress tracks a bounded queue and refresh only retries missing details", async () => {
  const ids = ["aaaaaaaaaaa", "bbbbbbbbbbb", "ccccccccccc", "ddddddddddd"];
  const releases = new Map<string, (day: string | undefined) => void>();
  const calls: string[] = [];
  let metadataCalls = 0;
  const { app, get } = await setup({
    background: true,
    metadata: async () => {
      metadataCalls++;
      throw new Error("Known fields must be reused");
    },
    publication: async (id) => {
      calls.push(id);
      return new Promise<string | undefined>((resolve) =>
        releases.set(id, resolve),
      );
    },
  });
  const complete = {
    ...source,
    channel: "Research",
    publishedOn: "2020-05-06",
    thumbnailUrl: "https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg",
  };
  await app.vault.saveSource(complete);
  for (const id of ids)
    await app.vault.saveSource({
      ...complete,
      id: `youtube:${id}`,
      videoId: id,
      url: `https://www.youtube.com/watch?v=${id}`,
      publishedOn: undefined,
    });
  const status = async () => (await get("/metadata/status")).json();
  const retry = async () =>
    (
      await app.fetch(
        new Request("http://127.0.0.1:4317/metadata/refresh", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        }),
      )
    ).json();
  async function until(check: () => Promise<boolean>) {
    for (let i = 0; i < 200; i++) {
      if (await check()) return;
      await Bun.sleep(5);
    }
    throw new Error("Queue did not reach expected state");
  }
  await get("/sources");
  expect(await status()).toMatchObject({
    total: 4,
    completed: 0,
    active: 2,
    queued: 2,
    estimatedRemainingSeconds: null,
  });
  await retry();
  await get("/sources");
  expect(await status()).toMatchObject({ total: 4, active: 2, queued: 2 });
  // Resolve one worker at a time; newly started work joins the map.
  for (let count = 1; count <= 3; count++) {
    await until(async () => releases.size > 0);
    const [id, resolve] = releases.entries().next().value!;
    releases.delete(id);
    resolve("2020-05-06");
    await until(async () => (await status()).completed === count);
  }
  expect(await status()).toMatchObject({
    total: 4,
    completed: 3,
    active: 1,
    queued: 0,
    incomplete: 0,
  });
  expect((await status()).estimatedRemainingSeconds).toBeGreaterThan(0);
  await until(async () => releases.size > 0);
  const [missingId, resolve] = releases.entries().next().value!;
  releases.delete(missingId);
  resolve(undefined);
  await until(async () => (await status()).completed === 4);
  expect(await status()).toMatchObject({
    total: 4,
    completed: 4,
    active: 0,
    queued: 0,
    incomplete: 1,
    estimatedRemainingSeconds: null,
  });
  expect(metadataCalls).toBe(0);
  expect(new Set(calls)).toEqual(new Set(ids));
  await get("/sources");
  expect(calls).toHaveLength(4); // unavailable results respect the automatic cooldown
  expect(await retry()).toMatchObject({ total: 1, active: 1, completed: 0 });
  await until(async () => calls.length === 5);
  expect(calls.at(-1)).toBe(missingId);
  expect(calls.filter((id) => id === missingId)).toHaveLength(2);
  releases.get(missingId)!("2021-02-03");
  await until(async () => (await status()).completed === 1);
  expect(await retry()).toMatchObject({
    total: 1,
    completed: 1,
    active: 0,
    queued: 0,
    incomplete: 0,
  });
  expect(calls).toHaveLength(5);
});

test("missing channel metadata is filled without refetching an existing release date", async () => {
  let metadataCalls = 0;
  let publicationCalls = 0;
  const { app, get } = await setup({
    background: true,
    metadata: async (videoId) => {
      metadataCalls++;
      return {
        videoId,
        url: source.url,
        title: source.title,
        channel: "Recovered channel",
        thumbnailUrl: "https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg",
      };
    },
    publication: async () => {
      publicationCalls++;
      return undefined;
    },
  });
  await app.vault.saveSource({ ...source, publishedOn: "2020-05-06" });
  await get("/sources");
  for (let i = 0; i < 200; i++) {
    if ((await (await get("/metadata/status")).json()).completed === 1) break;
    await Bun.sleep(5);
  }
  expect(metadataCalls).toBe(1);
  expect(publicationCalls).toBe(0);
  expect(await app.vault.getSource(source.id)).toMatchObject({
    channel: "Recovered channel",
    publishedOn: "2020-05-06",
  });
  await get("/sources");
  expect(metadataCalls).toBe(1);
});
