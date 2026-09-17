import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, realpath, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createCompanion } from "./index";

const master = "master-token-only-for-local-web-server";
const extension = "a".repeat(32);
const cleanup: Array<() => Promise<void>> = [];
afterEach(async () => {
  for (const close of cleanup.splice(0)) await close();
});
async function setup() {
  const root = await mkdtemp(join(await realpath(tmpdir()), "history-test-"));
  const app = await createCompanion({
    vaultPath: root,
    token: master,
    media: { background: false },
  });
  let closed = false;
  const close = () => {
    if (!closed) app.close();
    closed = true;
  };
  cleanup.push(async () => {
    close();
    await rm(root, { recursive: true, force: true });
  });
  const request = (
    path: string,
    data?: unknown,
    token = master,
    origin?: string,
    id = extension,
    method = data === undefined ? "GET" : "POST",
  ) =>
    app.fetch(
      new Request(`http://127.0.0.1:4317${path}`, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "X-KB-Extension-Id": id,
          ...(origin ? { Origin: origin } : {}),
        },
        body: data === undefined ? undefined : JSON.stringify(data),
      }),
    );
  const connect = async () => {
    const { code } = await (await request("/history/pair-code", {})).json();
    const response = await request(
      "/history/pair",
      { code },
      "",
      `chrome-extension://${extension}`,
    );
    expect(response.status).toBe(200);
    return { code, token: (await response.json()).token as string };
  };
  return { app, root, request, connect, close };
}
const entry = {
  videoId: "dQw4w9WgXcQ",
  title: "A useful video",
  channel: "Channel",
  watchedOn: "2026-01-15",
};
const batch = {
  runId: "run-1",
  batchId: "batch-1",
  cutoff: "2025-09-16",
  through: "2026-09-16",
  entries: [entry],
};

describe("history import capability and batching", () => {
  test("single-use pairing, scoped credential, origin binding, redaction and revocation", async () => {
    const { request, connect, root } = await setup();
    const { code, token } = await connect();
    expect((await request("/history/pair", { code }, "")).status).toBe(401);
    expect((await request("/history/pair-code", {}, token)).status).toBe(401);
    expect((await request("/sources", undefined, token)).status).toBe(401);
    expect((await request("/history/batches", batch, master)).status).toBe(401);
    expect(
      (await request("/history/batches", batch, token, "https://evil.test"))
        .status,
    ).toBe(403);
    expect(
      (
        await request(
          "/history/batches",
          batch,
          token,
          undefined,
          "b".repeat(32),
        )
      ).status,
    ).toBe(401);
    const status = await (await request("/history/connection")).text();
    expect(status).not.toContain(token);
    expect(status).not.toContain(code);
    expect(
      await readFile(join(root, ".kb/history-connection.json"), "utf8"),
    ).not.toContain(token);
    await request("/history/disconnect", {});
    expect((await request("/history/batches", batch, token)).status).toBe(401);
  });
  test("calendar window is inclusive; repeated batches and rewatched ignored sources never create new encounters", async () => {
    const { app, request, connect } = await setup();
    const { token } = await connect();
    const data = {
      ...batch,
      entries: [
        entry,
        { ...entry, videoId: "AAAAAAAAAAA", watchedOn: batch.cutoff },
        { ...entry, videoId: "BBBBBBBBBBB", watchedOn: "2025-09-15" },
        { ...entry, videoId: "CCCCCCCCCCC", watchedOn: "2026-09-17" },
      ],
    };
    const first = await request("/history/batches", data, token);
    expect(first.status).toBe(200);
    expect(await first.json()).toEqual({
      added: 2,
      known: 0,
      outsideWindow: 2,
    });
    expect(
      await (await request("/history/batches", data, token)).json(),
    ).toEqual({ added: 2, known: 0, outsideWindow: 2 });
    const source = (await app.vault.getSource(`youtube:${entry.videoId}`))!;
    expect(source.history).toEqual({
      provider: "youtube-history",
      watchedOn: entry.watchedOn,
    });
    expect(source.firstSeenAt.slice(0, 10)).not.toBe(entry.watchedOn);
    source.status = "ignored";
    await app.vault.saveSource(source);
    const next = await request(
      "/history/batches",
      {
        ...batch,
        batchId: "batch-2",
        entries: [{ ...entry, watchedOn: "2026-09-15" }],
      },
      token,
    );
    expect(await next.json()).toEqual({ added: 0, known: 1, outsideWindow: 0 });
    expect(await app.vault.getSource(source.id)).toEqual(source);
    expect(await app.vault.listSources()).toHaveLength(2);
  });
  test("validation precedes writes, batch IDs cannot be reused for different data, and YouTube toggle is respected", async () => {
    const { app, request, connect } = await setup();
    const { token } = await connect();
    const invalid = await request(
      "/history/batches",
      { ...batch, entries: [entry, { ...entry, watchedOn: "2026-02-30" }] },
      token,
    );
    expect(invalid.status).toBe(400);
    expect(await app.vault.listSources()).toHaveLength(0);
    expect(
      (
        await request(
          "/history/batches",
          { ...batch, entries: Array(101).fill(entry) },
          token,
        )
      ).status,
    ).toBe(400);
    await request("/history/batches", batch, token);
    expect(
      (await request("/history/batches", { ...batch, entries: [] }, token))
        .status,
    ).toBe(409);
    await app.state.update({ network: { youtube: false } });
    expect(
      (await request("/history/batches", { ...batch, batchId: "next" }, token))
        .status,
    ).toBe(403);
  });
  test("pairing and import receipts survive a companion restart", async () => {
    const { root, request, connect, close } = await setup();
    const { token } = await connect();
    await request("/history/batches", batch, token);
    close();
    const restarted = await createCompanion({
      vaultPath: root,
      token: master,
      media: { background: false },
    });
    try {
      const response = await restarted.fetch(
        new Request("http://127.0.0.1:4317/history/batches", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
            "X-KB-Extension-Id": extension,
          },
          body: JSON.stringify(batch),
        }),
      );
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        added: 1,
        known: 0,
        outsideWindow: 0,
      });
      expect(await restarted.vault.listSources()).toHaveLength(1);
    } finally {
      restarted.close();
    }
  });
  test("a fresh sync enriches existing videos with channel and image links without resetting decisions", async () => {
    const { app, request, connect } = await setup();
    const { token } = await connect();
    await request("/history/batches", batch, token);
    const old = (await app.vault.getSource(`youtube:${entry.videoId}`))!;
    old.status = "deferred";
    await app.vault.saveSource(old);
    const response = await request(
      "/history/batches",
      {
        ...batch,
        batchId: "with-images",
        entries: [
          {
            ...entry,
            channelUrl: "https://www.youtube.com/@channel",
            thumbnailUrl: `https://i.ytimg.com/vi/${entry.videoId}/mqdefault.jpg`,
            channelAvatarUrl: "https://yt3.ggpht.com/avatar",
          },
        ],
      },
      token,
    );
    expect(response.status).toBe(200);
    const updated = (await app.vault.getSource(old.id))!;
    expect(updated.channelAvatarUrl).toBe("https://yt3.ggpht.com/avatar");
    expect(updated.channelUrl).toBe("https://www.youtube.com/@channel");
    expect(updated.status).toBe("deferred");
    expect(updated.encounters).toEqual(old.encounters);
  });
});
