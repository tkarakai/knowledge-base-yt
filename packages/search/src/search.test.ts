import { describe, test, expect } from "bun:test";
import {
  SearchIndex,
  chunkDocuments,
  cosine,
  type SearchDocument,
} from "./index";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
const docs: SearchDocument[] = [
  {
    id: "knowledge:crdt",
    title: "CRDT convergence",
    text: "# Convergence\nReplicas merge without coordination.",
    path: "knowledge/crdt.md",
    type: "knowledge",
  },
  {
    id: "youtube:dQw4w9WgXcQ",
    title: "Talk",
    text: "Consensus and conflicts",
    path: "sources/youtube/dQw4w9WgXcQ/transcript.md",
    sourceId: "youtube:dQw4w9WgXcQ",
    type: "transcript",
    start: 60,
    end: 75,
  },
];
describe("rebuildable search", () => {
  test("stable chunks, FTS escaping, provenance, restart and deletion rebuild", async () => {
    const root = await mkdtemp(join(tmpdir(), "kb-search-"));
    try {
      const path = join(root, "index.sqlite");
      let index = new SearchIndex(path);
      expect(await index.rebuild(docs)).toEqual({ chunks: 2 });
      const first = await index.search("convergence");
      expect(first[0].id).toBe("knowledge:crdt");
      expect(first[0].semanticScore).toBe(0);
      expect(index.diagnostics.mode).toBe("lexical");
      expect((await index.search('" OR * ( consensus'))[0].start).toBe(60);
      const stable = chunkDocuments(docs).map((c) => c.chunkId);
      expect(
        chunkDocuments(docs.slice().reverse()).map((c) => c.chunkId),
      ).toEqual(stable);
      index.close();
      index = new SearchIndex(path);
      expect((await index.search("convergence"))[0].chunkId).toBe(
        first[0].chunkId,
      );
      index.close();
      await rm(path);
      index = new SearchIndex(path);
      await index.rebuild(docs);
      expect((await index.search("convergence"))[0].chunkId).toBe(
        first[0].chunkId,
      );
      index.close();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
  test("OpenAI-compatible semantic ranking and model-change fallback", async () => {
    const calls: string[] = [];
    const mockFetch = async (_url: unknown, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      calls.push(body.model);
      return Response.json({
        data: body.input.map((s: string, index: number) => ({
          index,
          embedding:
            s.includes("Convergence") || s.includes("distributed")
              ? [1, 0]
              : [0, 1],
        })),
      });
    };
    const index = new SearchIndex(":memory:", {
      enabled: true,
      config: { baseUrl: "http://local/v1", model: "fixture" },
      fetch: mockFetch as unknown as typeof fetch,
    });
    await index.rebuild(docs);
    const result = await index.search("distributed");
    expect(result[0].id).toBe("knowledge:crdt");
    expect(result[0].lexicalScore).toBe(0);
    expect(result[0].semanticScore).toBe(1);
    expect(index.diagnostics.mode).toBe("hybrid");
    index.configure({
      enabled: true,
      config: { baseUrl: "http://local/v1", model: "other" },
      fetch: mockFetch as unknown as typeof fetch,
    });
    await index.search("convergence");
    expect(index.diagnostics.mode).toBe("lexical");
    expect(index.diagnostics.reason).toContain("rebuild");
    expect(calls.length).toBeGreaterThan(1);
    index.close();
  });
  test("failed and malformed embedding providers fail honestly to lexical", async () => {
    const index = new SearchIndex(":memory:", {
      enabled: true,
      config: { baseUrl: "http://local/v1", model: "fixture" },
      fetch: (async () =>
        Response.json({
          data: [{ index: 0, embedding: ["bad"] }],
        })) as unknown as typeof fetch,
    });
    await index.rebuild(docs);
    expect((await index.search("convergence"))[0].semanticScore).toBe(0);
    expect(index.diagnostics.mode).toBe("lexical");
    expect(cosine([1], [0])).toBe(0);
    index.close();
  });
});
