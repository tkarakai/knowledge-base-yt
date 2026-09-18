import { Database } from "bun:sqlite";
import { createHash } from "node:crypto";
import type { ModelConfig, SearchResult } from "@repo/kb-shared";

export interface SearchDocument {
  id: string;
  title: string;
  text: string;
  path: string;
  type: SearchResult["type"];
  sourceId?: string;
  start?: number;
  end?: number;
}
export interface Chunk extends SearchDocument {
  chunkId: string;
  contentHash: string;
}
export interface EmbeddingOptions {
  enabled: boolean;
  config: ModelConfig;
  fetch?: typeof fetch;
}
const hash = (s: string) => createHash("sha256").update(s).digest("hex");
export function chunkDocuments(documents: SearchDocument[]): Chunk[] {
  return documents
    .slice()
    .sort(
      (a, b) =>
        a.id.localeCompare(b.id) ||
        a.path.localeCompare(b.path) ||
        (a.start ?? 0) - (b.start ?? 0),
    )
    .flatMap((doc) => {
      const sections = doc.text
        .split(/\n(?=#{1,6} )/)
        .flatMap((section) => {
          const parts: string[] = [];
          for (let i = 0; i < section.length; i += 1800)
            parts.push(section.slice(i, i + 1800));
          return parts;
        })
        .filter((s) => s.trim());
      const occurrences = new Map<string, number>();
      return sections.map((text) => {
        const contentHash = hash(text),
          n = occurrences.get(contentHash) ?? 0;
        occurrences.set(contentHash, n + 1);
        return {
          ...doc,
          text,
          contentHash,
          chunkId: `${doc.id}:${doc.start ?? "text"}:${contentHash.slice(0, 16)}:${n}`,
        };
      });
    });
}
export function cosine(a: number[], b: number[]): number {
  if (a.length !== b.length || !a.length) return 0;
  let dot = 0,
    aa = 0,
    bb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    aa += a[i] * a[i];
    bb += b[i] * b[i];
  }
  return aa && bb ? dot / Math.sqrt(aa * bb) : 0;
}
export class SearchIndex {
  readonly db: Database;
  diagnostics: {
    mode: "hybrid" | "lexical";
    reason?: string;
    embeddingModel?: string;
  } = { mode: "lexical", reason: "Embeddings not configured" };
  private embeddings: EmbeddingOptions;
  constructor(
    path: string,
    embeddings: EmbeddingOptions = {
      enabled: false,
      config: { baseUrl: "", model: "" },
    },
  ) {
    this.embeddings = embeddings;
    this.db = new Database(path, { create: true });
    this.db.exec(
      `PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS chunks (chunk_id TEXT PRIMARY KEY, data TEXT NOT NULL, vector TEXT, model TEXT, dimensions INTEGER, generated_at TEXT); CREATE VIRTUAL TABLE IF NOT EXISTS chunk_fts USING fts5(chunk_id UNINDEXED,title,text,tokenize='unicode61');`,
    );
  }
  configure(options: EmbeddingOptions) {
    this.embeddings = options;
  }
  private modelKey() {
    return `${this.embeddings.config.baseUrl}|${this.embeddings.config.model}`;
  }
  private async embed(input: string[]): Promise<number[][]> {
    const { enabled, config } = this.embeddings;
    if (!enabled || !config.baseUrl || !config.model)
      throw new Error("Embeddings disabled or unconfigured");
    const url = new URL(config.baseUrl.replace(/\/$/, "") + "/embeddings");
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password
    )
      throw new Error("Invalid embedding endpoint");
    const response = await (this.embeddings.fetch ?? fetch)(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}),
      },
      body: JSON.stringify({ model: config.model, input }),
      signal: AbortSignal.timeout(20_000),
      redirect: "error",
    });
    if (!response.ok) throw new Error("Embedding provider unavailable");
    const reader = response.body?.getReader();
    if (!reader) throw new Error("Empty embedding response");
    const pieces: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 8 * 1024 * 1024) {
        await reader.cancel();
        throw new Error("Embedding response too large");
      }
      pieces.push(value);
    }
    const payload = JSON.parse(Buffer.concat(pieces).toString()) as {
      data?: { index: number; embedding: number[] }[];
    };
    if (!Array.isArray(payload.data) || payload.data.length !== input.length)
      throw new Error("Invalid embedding response");
    const ordered = payload.data.slice().sort((a, b) => a.index - b.index);
    const dimensions = ordered[0]?.embedding?.length;
    if (
      !dimensions ||
      dimensions > 16384 ||
      ordered.some(
        (x, i) =>
          x.index !== i ||
          !Array.isArray(x.embedding) ||
          x.embedding.length !== dimensions ||
          x.embedding.some((v) => typeof v !== "number" || !Number.isFinite(v)),
      )
    )
      throw new Error("Invalid embedding vectors");
    return ordered.map((x) => x.embedding);
  }
  async rebuild(documents: SearchDocument[]): Promise<{ chunks: number }> {
    const chunks = chunkDocuments(documents);
    let vectors: number[][] = [];
    try {
      if (
        !chunks.length ||
        !this.embeddings.enabled ||
        !this.embeddings.config.model ||
        !this.embeddings.config.baseUrl
      )
        throw new Error("No embeddings");
      for (let i = 0; i < chunks.length; i += 32)
        vectors.push(
          ...(await this.embed(chunks.slice(i, i + 32).map((c) => c.text))),
        );
      this.diagnostics = {
        mode: "hybrid",
        embeddingModel: this.embeddings.config.model,
      };
    } catch {
      vectors = [];
      this.diagnostics = {
        mode: "lexical",
        reason: this.embeddings.enabled
          ? "Embeddings unconfigured or unavailable"
          : "Embedding network disabled",
      };
    }
    const insert = this.db.prepare("INSERT INTO chunks VALUES (?,?,?,?,?,?)"),
      fts = this.db.prepare("INSERT INTO chunk_fts VALUES (?,?,?)");
    this.db.transaction(() => {
      this.db.exec("DELETE FROM chunks; DELETE FROM chunk_fts;");
      chunks.forEach((chunk, i) => {
        insert.run(
          chunk.chunkId,
          JSON.stringify(chunk),
          vectors[i] ? JSON.stringify(vectors[i]) : null,
          vectors[i] ? this.modelKey() : null,
          vectors[i]?.length ?? null,
          vectors[i] ? new Date().toISOString() : null,
        );
        fts.run(chunk.chunkId, chunk.title, chunk.text);
      });
    })();
    return { chunks: chunks.length };
  }
  async search(query: string, limit = 20): Promise<SearchResult[]> {
    if (!query.trim()) return [];
    const tokens = query.match(/[\p{L}\p{N}_]+/gu)?.slice(0, 32) ?? [];
    const lexical = tokens.length
      ? (this.db
          .query(
            "SELECT chunk_id,bm25(chunk_fts) rank FROM chunk_fts WHERE chunk_fts MATCH ? ORDER BY rank,chunk_id LIMIT 200",
          )
          .all(tokens.map((t) => `"${t}"`).join(" OR ")) as {
          chunk_id: string;
          rank: number;
        }[])
      : [];
    const lex = new Map(lexical.map((x, i) => [x.chunk_id, 1 / (i + 1)]));
    let queryVector: number[] | undefined;
    try {
      queryVector = (await this.embed([query]))[0];
      this.diagnostics = {
        mode: "hybrid",
        embeddingModel: this.embeddings.config.model,
      };
    } catch {
      this.diagnostics = {
        mode: "lexical",
        reason: this.embeddings.enabled
          ? "Embeddings unconfigured or unavailable"
          : "Embedding network disabled",
      };
    }
    const rows = this.db
      .query("SELECT * FROM chunks ORDER BY chunk_id")
      .all() as {
      data: string;
      chunk_id: string;
      vector: string | null;
      model: string | null;
    }[];
    const validVectors = rows.some(
      (row) =>
        row.vector &&
        row.model === this.modelKey() &&
        JSON.parse(row.vector).length === queryVector?.length,
    );
    if (queryVector && !validVectors) {
      queryVector = undefined;
      this.diagnostics = {
        mode: "lexical",
        reason: "Index embeddings missing or model changed; rebuild required",
      };
    }
    return rows
      .map((row) => {
        const chunk = JSON.parse(row.data) as Chunk;
        const lexicalScore = lex.get(row.chunk_id) ?? 0;
        const semanticScore =
          queryVector && row.vector && row.model === this.modelKey()
            ? Math.max(0, cosine(queryVector, JSON.parse(row.vector)))
            : 0;
        return {
          id: chunk.id,
          chunkId: chunk.chunkId,
          title: chunk.title,
          excerpt: chunk.text.slice(0, 1200),
          path: chunk.path,
          type: chunk.type,
          sourceId: chunk.sourceId,
          start: chunk.start,
          end: chunk.end,
          lexicalScore,
          semanticScore,
          score: queryVector
            ? 0.45 * lexicalScore + 0.55 * semanticScore
            : lexicalScore,
        };
      })
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score || a.chunkId.localeCompare(b.chunkId))
      .slice(0, Math.max(1, Math.min(limit, 100)));
  }
  close() {
    this.db.exec("PRAGMA wal_checkpoint(TRUNCATE)");
    this.db.close();
  }
}
