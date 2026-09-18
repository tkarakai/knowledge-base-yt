import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { proxyCompanion } from "../../src/lib/kb/proxy";
import { markdownDiff } from "../../src/lib/kb/diff";

const originalFetch = globalThis.fetch;
const originalToken = process.env.KB_COMPANION_TOKEN;
const originalUrl = process.env.KB_COMPANION_URL;
const upstream = mock(
  async (_url: unknown, _options?: Parameters<typeof globalThis.fetch>[1]) =>
    Response.json({ ok: true }),
);

beforeEach(() => {
  process.env.KB_COMPANION_TOKEN = "test-companion-secret";
  delete process.env.KB_COMPANION_URL;
  upstream.mockReset();
  upstream.mockImplementation(async () => Response.json({ ok: true }));
  globalThis.fetch = upstream as unknown as typeof fetch;
});
afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalToken === undefined) delete process.env.KB_COMPANION_TOKEN;
  else process.env.KB_COMPANION_TOKEN = originalToken;
  if (originalUrl === undefined) delete process.env.KB_COMPANION_URL;
  else process.env.KB_COMPANION_URL = originalUrl;
});
function request(
  method = "GET",
  extra: Record<string, string> = {},
  body?: string,
) {
  return new Request("http://localhost:3001/api/kb/sources", {
    method,
    headers: {
      host: "localhost:3001",
      ...(method !== "GET"
        ? {
            origin: "http://localhost:3001",
            "content-type": "application/json",
          }
        : {}),
      ...extra,
    },
    body,
  });
}

describe("KB companion proxy", () => {
  it("allows only the two model connection checks", async () => {
    for (const model of ["inference", "embeddings"]) {
      expect(
        (
          await proxyCompanion(request("POST", {}, "{}"), [
            "settings",
            model,
            "check",
          ])
        ).status,
      ).toBe(200);
    }
    expect(
      (
        await proxyCompanion(request("POST", {}, "{}"), [
          "settings",
          "other",
          "check",
        ])
      ).status,
    ).toBe(404);
    expect(
      (await proxyCompanion(request("GET"), ["settings", "inference", "check"]))
        .status,
    ).toBe(404);
  });
  it("adds the server token and omits browser cookies and origin", async () => {
    const response = await proxyCompanion(
      request("GET", {
        cookie: "secret-session",
        origin: "http://localhost:3001",
      }),
      ["sources", "youtube:abc123"],
    );
    expect(response.status).toBe(200);
    const [url, options] = upstream.mock.calls[0];
    expect(String(url)).toBe("http://127.0.0.1:4317/sources/youtube%3Aabc123");
    expect(options?.headers).toEqual({
      Authorization: "Bearer test-companion-secret",
      "Content-Type": "application/json",
      Accept: "application/json",
    });
    expect(options?.redirect).toBe("error");
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
  it("rejects foreign origins, rebinding hosts, mismatched ports and null origins", async () => {
    for (const headers of [
      { origin: "https://attacker.test" },
      { host: "attacker.test" },
      { origin: "http://localhost:8888" },
      { origin: "null" },
      { "sec-fetch-site": "cross-site" },
      { host: "localhost:3001@attacker.test" },
    ]) {
      expect(
        (await proxyCompanion(request("GET", headers), ["health"])).status,
      ).toBe(403);
    }
    expect(upstream).not.toHaveBeenCalled();
  });
  it("requires a browser origin and JSON for mutations", async () => {
    expect(
      (
        await proxyCompanion(
          new Request("http://localhost:3001/api/kb/sources", {
            method: "POST",
            headers: {
              host: "localhost:3001",
              "content-type": "application/json",
            },
            body: "{}",
          }),
          ["sources"],
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await proxyCompanion(
          request("POST", { "content-type": "text/plain" }, "{}"),
          ["sources"],
        )
      ).status,
    ).toBe(415);
    expect(
      (await proxyCompanion(request("POST", {}, "broken"), ["sources"])).status,
    ).toBe(400);
    expect(upstream).not.toHaveBeenCalled();
  });
  it("blocks unknown endpoints and unsafe segments before fetching", async () => {
    for (const path of [
      ["admin"],
      ["sources", "../private"],
      ["knowledge", ".."],
      ["sources", "a\\b"],
      ["sources", "id?token=x"],
      ["history", "pair"],
      ["history", "batches"],
    ])
      expect((await proxyCompanion(request(), path)).status).toBe(404);
    expect(upstream).not.toHaveBeenCalled();
  });
  it("never exposes extension pairing or ingestion through the master-token web proxy", async () => {
    for (const path of [
      ["history", "pair"],
      ["history", "batches"],
    ])
      expect(
        (await proxyCompanion(request("POST", {}, "{}"), path)).status,
      ).toBe(404);
    expect(upstream).not.toHaveBeenCalled();
  });
  it("enforces the 2 MiB bound even without Content-Length", async () => {
    expect(
      (
        await proxyCompanion(
          request(
            "POST",
            {},
            JSON.stringify({ text: "x".repeat(2 * 1024 * 1024) }),
          ),
          ["documents"],
        )
      ).status,
    ).toBe(413);
    expect(upstream).not.toHaveBeenCalled();
  });
  it("honors a custom loopback port but rejects remote or credentialed companion URLs", async () => {
    process.env.KB_COMPANION_URL = "http://127.0.0.1:55111";
    expect((await proxyCompanion(request(), ["health"])).status).toBe(200);
    expect(String(upstream.mock.calls[0][0])).toBe(
      "http://127.0.0.1:55111/health",
    );
    for (const url of [
      "https://attacker.test",
      "http://localhost:4317",
      "http://user:pass@127.0.0.1:4317",
      "http://127.0.0.1:4317/path",
      "http://127.0.0.1:4317?secret=x",
    ]) {
      process.env.KB_COMPANION_URL = url;
      expect((await proxyCompanion(request(), ["health"])).status).toBe(503);
    }
  });
  it("returns actionable missing configuration and offline errors without credentials", async () => {
    delete process.env.KB_COMPANION_TOKEN;
    expect((await proxyCompanion(request(), ["health"])).status).toBe(503);
    process.env.KB_COMPANION_TOKEN = "test-companion-secret";
    upstream.mockRejectedValue(
      new Error("test-companion-secret transport detail"),
    );
    const response = await proxyCompanion(request(), ["health"]);
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("test-companion-secret");
  });
  it("redacts tokens from JSON and passes only safe retrieval response headers", async () => {
    upstream.mockImplementation(async () =>
      Response.json(
        {
          error: "token test-companion-secret",
          nested: ["test-companion-secret"],
        },
        {
          status: 409,
          headers: {
            "set-cookie": "secret=1",
            "X-KB-Retrieval-Mode": "lexical",
            "X-KB-Retrieval-Reason": "Embedding network disabled",
          },
        },
      ),
    );
    const response = await proxyCompanion(request(), ["search"]);
    expect(response.status).toBe(409);
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(response.headers.get("X-KB-Retrieval-Mode")).toBe("lexical");
    expect(await response.text()).not.toContain("test-companion-secret");
  });
  it("preserves the exact edited review body", async () => {
    const body = JSON.stringify({
      decisions: [
        {
          changeId: "one",
          action: "accept",
          markdown: "# My edit\n\n[source](https://youtube.com/watch?v=x&t=12)",
        },
        { changeId: "two", action: "reject" },
      ],
    });
    expect(
      (
        await proxyCompanion(request("POST", {}, body), [
          "proposals",
          "proposal:one",
          "review",
        ])
      ).status,
    ).toBe(200);
    expect(upstream.mock.calls[0][1]?.body).toBe(body);
  });
  it("proxies only bounded image responses and strips upstream cookies", async () => {
    const bytes = new Uint8Array([137, 80, 78, 71]);
    upstream.mockImplementation(
      async () =>
        new Response(bytes, {
          headers: {
            "Content-Type": "image/png",
            "Set-Cookie": "secret=value",
          },
        }),
    );
    const image = await proxyCompanion(request(), [
      "sources",
      "youtube:dQw4w9WgXcQ",
      "media",
      "thumbnail",
    ]);
    expect(new Uint8Array(await image.arrayBuffer())).toEqual(bytes);
    expect(image.headers.get("content-type")).toBe("image/png");
    expect(image.headers.get("set-cookie")).toBeNull();
    upstream.mockImplementation(
      async () =>
        new Response("<svg/>", {
          headers: { "Content-Type": "image/svg+xml" },
        }),
    );
    expect(
      (
        await proxyCompanion(request(), [
          "sources",
          "youtube:dQw4w9WgXcQ",
          "media",
          "avatar",
        ])
      ).status,
    ).toBe(502);
    upstream.mockImplementation(
      async () =>
        new Response(new Uint8Array(1024 * 1024 + 1), {
          headers: { "Content-Type": "image/png" },
        }),
    );
    expect(
      (
        await proxyCompanion(request(), [
          "sources",
          "youtube:dQw4w9WgXcQ",
          "media",
          "thumbnail",
        ])
      ).status,
    ).toBe(413);
  });
});

describe("Markdown proposal diff", () => {
  it("keeps context while distinguishing edits, additions and deletions", () => {
    expect(
      markdownDiff("# Title\nOld idea\nSource", "# Title\nBetter idea\nSource"),
    ).toEqual([
      { kind: "same", text: "# Title" },
      { kind: "removed", text: "Old idea" },
      { kind: "added", text: "Better idea" },
      { kind: "same", text: "Source" },
    ]);
    expect(markdownDiff("", "New")).toEqual([{ kind: "added", text: "New" }]);
    expect(markdownDiff("Old", "")).toEqual([{ kind: "removed", text: "Old" }]);
  });
  it("bounds large document comparisons without losing unchanged suffixes", () => {
    const lines = Array.from({ length: 700 }, (_, i) => String(i));
    const next = [...lines];
    next[350] = "edited";
    const diff = markdownDiff(lines.join("\n"), next.join("\n"));
    expect(diff.filter((line) => line.kind === "added")).toEqual([
      { kind: "added", text: "edited" },
    ]);
    expect(diff.at(-1)).toEqual({ kind: "same", text: "699" });
  });
});

describe("job trace proxy", () => {
  it("allows authenticated trace reads but no arbitrary trace filesystem access", async () => {
    expect(
      (await proxyCompanion(request(), ["jobs", "job:one", "trace"])).status,
    ).toBe(200);
    expect(
      (await proxyCompanion(request(), ["traces", "settings.json"])).status,
    ).toBe(404);
    expect(
      (await proxyCompanion(request(), ["jobs", "../settings", "trace"]))
        .status,
    ).toBe(404);
  });
});
