import { constants } from "node:fs";
import * as fs from "node:fs/promises";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import type {
  Source,
  Transcript,
  Reflection,
  KnowledgeNote,
  SynthesisProposal,
  TimelineEvent,
  TranscriptSegment,
  AgentRunResult,
} from "@repo/kb-shared";
import {
  VaultError,
  MAX_FILE_BYTES,
  parseMarkdown,
  serializeMarkdown,
  safeId,
  validate,
  type Kind,
  type ParsedRecord,
  type RecordData,
} from "./schema";
export {
  VaultError,
  parseMarkdown,
  serializeMarkdown,
  timestamp,
} from "./schema";
export interface VaultScanEntry {
  id: string;
  type: "knowledge" | "source" | "transcript" | "reflection" | "document";
  title: string;
  markdown: string;
  path: string;
  sourceId?: string;
  segments?: TranscriptSegment[];
}
export type AgentAudit = AgentRunResult["audit"] & {
  id: string;
  sourceId: string;
  proposalId?: string;
};
interface DiskRecord extends ParsedRecord {
  path: string;
}
const folders = [
  "sources",
  "knowledge",
  "documents",
  "proposals",
  "history",
  "agent-runs",
  ".kb",
];
const locks = new Map<string, Promise<unknown>>();
const exists = async (p: string) => {
  try {
    return await fs.lstat(p);
  } catch (e: any) {
    if (e.code === "ENOENT") return null;
    throw e;
  }
};
const hash = (text: string) => createHash("sha256").update(text).digest("hex");

/** Portable defenses for a trusted local vault: no path input can escape the root,
 * no symlinks/hardlinks/special files are followed. A hostile process with write
 * access to an ancestor can still race portable Node filesystem operations. */
export class Vault {
  readonly root: string;
  private initialized = false;
  private catalog: Map<string, DiskRecord> | null = null;
  private identities = new Map<string, DiskRecord>();
  private parsedFiles = new Map<
    string,
    { signature: string; record: ParsedRecord | null }
  >();
  private scanInFlight: Promise<DiskRecord[]> | null = null;
  private refreshing = false;
  private refreshedAt = 0;
  private refreshError: unknown;
  private counters = {
    scans: 0,
    filesRead: 0,
    parsedCacheHits: 0,
    catalogHits: 0,
    writes: 0,
    lastScanMs: 0,
  };
  /** The companion uses an eventually refreshed catalog for lists. Direct reads and
   * writes still validate their target on disk; explicit refresh reconciles editors. */
  constructor(
    root: string,
    private options: { cache?: boolean; refreshMs?: number } = {},
  ) {
    if (!root || root.includes("\0"))
      throw new VaultError("A vault root is required", "PATH_UNSAFE");
    this.root = path.resolve(root);
    if (this.root === path.parse(this.root).root)
      throw new VaultError("Filesystem root cannot be a vault", "PATH_UNSAFE");
  }
  private async exclusive<T>(fn: () => Promise<T>): Promise<T> {
    const previous = locks.get(this.root) ?? Promise.resolve();
    const next = previous.catch(() => {}).then(fn);
    locks.set(this.root, next);
    try {
      return await next;
    } finally {
      if (locks.get(this.root) === next) locks.delete(this.root);
    }
  }
  private relative(relative: string): string {
    if (
      !relative ||
      path.isAbsolute(relative) ||
      relative.includes("\\") ||
      relative.includes("\0") ||
      relative.split("/").some((s) => !s || s === "." || s === "..") ||
      /^[A-Za-z]:/.test(relative)
    )
      throw new VaultError("Unsafe vault path", "PATH_UNSAFE");
    const absolute = path.resolve(this.root, relative);
    if (!absolute.startsWith(this.root + path.sep))
      throw new VaultError("Path escapes vault", "PATH_UNSAFE");
    return absolute;
  }
  private async directory(absolute: string, create = false): Promise<void> {
    const parsed = path.parse(absolute);
    let current = parsed.root;
    for (const component of absolute
      .slice(parsed.root.length)
      .split(path.sep)
      .filter(Boolean)) {
      current = path.join(current, component);
      let stat = await exists(current);
      if (!stat && create) {
        try {
          await fs.mkdir(current, { mode: 0o700 });
        } catch (e: any) {
          if (e.code !== "EEXIST") throw e;
        }
        stat = await exists(current);
      }
      if (!stat || stat.isSymbolicLink() || !stat.isDirectory())
        throw new VaultError(
          "Vault directory is missing or unsafe",
          "PATH_UNSAFE",
        );
    }
  }
  private async checked(
    relative: string,
    createParents = false,
  ): Promise<string> {
    const absolute = this.relative(relative);
    await this.directory(path.dirname(absolute), createParents);
    const stat = await exists(absolute);
    if (stat && (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1))
      throw new VaultError(
        "Vault target must be an unlinked regular file",
        "PATH_UNSAFE",
      );
    return absolute;
  }
  private ready() {
    if (!this.initialized) throw new VaultError("Call vault.init() first");
  }
  async init(): Promise<void> {
    await this.exclusive(async () => {
      await this.directory(this.root, true);
      for (const folder of folders)
        await this.directory(path.join(this.root, folder), true);
      this.initialized = true;
    });
  }
  async internalPath(filename: string): Promise<string> {
    this.ready();
    if (
      !/^[A-Za-z0-9][A-Za-z0-9_.-]{0,100}$/.test(filename) ||
      filename.includes("..")
    )
      throw new VaultError("Invalid internal filename", "PATH_UNSAFE");
    return this.checked(`.kb/${filename}`);
  }
  private async read(relative: string): Promise<string> {
    const absolute = await this.checked(relative);
    const handle = await fs.open(
      absolute,
      constants.O_RDONLY | constants.O_NOFOLLOW,
    );
    try {
      const stat = await handle.stat();
      if (!stat.isFile() || stat.nlink !== 1)
        throw new VaultError("Unsafe vault file", "PATH_UNSAFE");
      if (stat.size > MAX_FILE_BYTES)
        throw new VaultError("Markdown exceeds size limit", "TOO_LARGE");
      // Bounded even if another local editor grows the file after fstat.
      this.counters.filesRead++;
      const chunks: Buffer[] = [];
      let count = 0;
      while (count <= MAX_FILE_BYTES) {
        const bytes = Buffer.alloc(
          Math.min(
            65536,
            MAX_FILE_BYTES + 1 - count,
            Math.max(4096, stat.size + 1 - count),
          ),
        );
        const r = await handle.read(bytes, 0, bytes.length, null);
        if (!r.bytesRead) break;
        chunks.push(bytes.subarray(0, r.bytesRead));
        count += r.bytesRead;
      }
      if (count > MAX_FILE_BYTES)
        throw new VaultError("Markdown exceeds size limit", "TOO_LARGE");
      await this.checked(relative);
      return Buffer.concat(chunks, count).toString("utf8");
    } finally {
      await handle.close();
    }
  }
  private async stage(
    relative: string,
    text: string | Uint8Array,
  ): Promise<string> {
    if (Buffer.byteLength(text) > MAX_FILE_BYTES)
      throw new VaultError("Markdown exceeds size limit", "TOO_LARGE");
    await this.checked(relative, true);
    const temporary = path.posix.join(
      path.posix.dirname(relative),
      `.kb-write-${randomUUID()}.tmp`,
    );
    const handle = await fs.open(
      await this.checked(temporary),
      constants.O_WRONLY |
        constants.O_CREAT |
        constants.O_EXCL |
        constants.O_NOFOLLOW,
      0o600,
    );
    try {
      await handle.writeFile(text, "utf8");
      await handle.sync();
    } catch (e) {
      await fs.unlink(this.relative(temporary)).catch(() => {});
      throw e;
    } finally {
      await handle.close();
    }
    return temporary;
  }
  private async publish(temporary: string, relative: string) {
    const target = await this.checked(relative);
    const temp = await this.checked(temporary);
    await fs.rename(temp, target);
    const directory = await fs.open(
      path.dirname(target),
      constants.O_RDONLY | constants.O_NOFOLLOW,
    );
    try {
      await directory.sync();
    } finally {
      await directory.close();
    }
    this.counters.writes++;
    if (this.options.cache && relative.endsWith(".md")) {
      const parsed = parseMarkdown(await this.read(relative));
      this.remember(relative, parsed);
      this.parsedFiles.delete(relative);
    }
  }
  private async atomic(relative: string, text: string | Uint8Array) {
    const temporary = await this.stage(relative, text);
    try {
      await this.publish(temporary, relative);
    } finally {
      await fs.unlink(this.relative(temporary)).catch(() => {});
    }
  }
  private identity(record: ParsedRecord) {
    return `${record.kind}:${record.data.id ?? record.data.sourceId}`;
  }
  private remember(file: string, parsed: ParsedRecord | null) {
    const previous = this.catalog?.get(file);
    if (previous) this.identities.delete(this.identity(previous));
    if (parsed) {
      const record = { ...parsed, path: file };
      this.catalog?.set(file, record);
      this.identities.set(this.identity(record), record);
    } else this.catalog?.delete(file);
  }
  diagnostics() {
    return {
      ...this.counters,
      catalogSize: this.catalog?.size ?? 0,
      refreshing: this.refreshing,
    };
  }
  /** Explicit reconciliation for user-requested refresh/rebuild and strict writes. */
  async refresh() {
    return this.exclusive(async () => {
      await this.records(true);
    });
  }
  private async records(force = false): Promise<DiskRecord[]> {
    this.ready();
    if (this.options.cache && this.catalog && !force) {
      if (
        !this.refreshing &&
        Date.now() - this.refreshedAt > (this.options.refreshMs ?? 5000)
      ) {
        this.refreshing = true;
        void this.refresh()
          .catch((error) => {
            this.refreshError = error;
          })
          .finally(() => {
            this.refreshing = false;
          });
      }
      if (this.refreshError) throw this.refreshError;
      this.counters.catalogHits++;
      return [...this.catalog.values()];
    }
    if (!this.scanInFlight) {
      this.scanInFlight = this.scanRecords().finally(() => {
        this.scanInFlight = null;
      });
    }
    return this.scanInFlight;
  }
  private async scanRecords(): Promise<DiskRecord[]> {
    const started = performance.now();
    this.counters.scans++;
    await this.directory(this.root);
    const files: string[] = [];
    const directories = [{ relative: "", depth: 0 }];
    let count = 0;
    // Bounded I/O concurrency: a large vault never starts thousands of reads at once.
    while (directories.length) {
      const batch = directories.splice(0, 8);
      await Promise.all(
        batch.map(async ({ relative, depth }) => {
          if (depth > 32)
            throw new VaultError(
              "Vault exceeds directory depth limit",
              "TOO_LARGE",
            );
          const absolute = relative ? this.relative(relative) : this.root;
          await this.directory(absolute);
          const entries = await fs.readdir(absolute, { withFileTypes: true });
          for (const entry of entries) {
            if (entry.name.startsWith(".") || entry.name === "node_modules")
              continue;
            const file = relative ? `${relative}/${entry.name}` : entry.name;
            if (++count > 100000)
              throw new VaultError(
                "Vault exceeds scan entry limit",
                "TOO_LARGE",
              );
            if (entry.isSymbolicLink())
              throw new VaultError(
                "Symlinks are forbidden in the vault",
                "PATH_UNSAFE",
              );
            if (entry.isDirectory())
              directories.push({ relative: file, depth: depth + 1 });
            else if (entry.name.toLowerCase().endsWith(".md")) files.push(file);
          }
        }),
      );
    }
    files.sort((a, b) => a.localeCompare(b));
    const result: DiskRecord[] = [];
    const identities = new Set<string>();
    for (let i = 0; i < files.length; i += 16) {
      const records = await Promise.all(
        files.slice(i, i + 16).map(async (file) => {
          const stat = await fs.lstat(this.relative(file));
          if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1)
            throw new VaultError("Unsafe vault file", "PATH_UNSAFE");
          const signature = `${stat.dev}:${stat.ino}:${stat.size}:${stat.mtimeMs}:${stat.ctimeMs}`;
          const cached = this.options.cache
            ? this.parsedFiles.get(file)
            : undefined;
          let parsed: ParsedRecord | null;
          if (cached?.signature === signature) {
            parsed = cached.record;
            this.counters.parsedCacheHits++;
          } else {
            parsed = parseMarkdown(await this.read(file));
            if (this.options.cache)
              this.parsedFiles.set(file, { signature, record: parsed });
          }
          return parsed ? { ...parsed, path: file } : null;
        }),
      );
      for (const record of records) {
        if (!record) continue;
        const identity = this.identity(record);
        if (identities.has(identity))
          throw new VaultError(
            `Duplicate ${record.kind} ID: ${record.data.id ?? record.data.sourceId}`,
            "CONFLICT",
          );
        identities.add(identity);
        result.push(record);
      }
    }
    if (this.options.cache) {
      this.catalog = new Map(result.map((record) => [record.path, record]));
      this.identities = new Map(
        result.map((record) => [this.identity(record), record]),
      );
      const existing = new Set(files);
      for (const file of this.parsedFiles.keys())
        if (!existing.has(file)) this.parsedFiles.delete(file);
    }
    this.refreshedAt = Date.now();
    this.refreshError = undefined;
    this.counters.lastScanMs = performance.now() - started;
    return result;
  }
  private async lookup(
    kind: Kind,
    id: string,
    locked = false,
  ): Promise<DiskRecord | null> {
    safeId(id);
    const records = await this.records();
    if (!this.options.cache)
      return (
        records.find(
          (r) => r.kind === kind && (r.data.id ?? r.data.sourceId) === id,
        ) ?? null
      );
    const record = this.identities.get(`${kind}:${id}`);
    if (!record) return null;
    try {
      const parsed = parseMarkdown(await this.read(record.path));
      if (parsed && this.identity(parsed) === `${kind}:${id}`) {
        this.remember(record.path, parsed);
        return { ...parsed, path: record.path };
      }
    } catch (error) {
      if (
        (error as NodeJS.ErrnoException).code !== "ENOENT" &&
        !(
          error instanceof VaultError &&
          error.code === "PATH_UNSAFE" &&
          !(await exists(this.relative(record.path)))
        )
      )
        throw error;
    }
    // A local editor moved/deleted/changed the identity of the known file.
    if (locked) await this.records(true);
    else await this.refresh();
    const fresh = [...(this.catalog?.values() ?? [])];
    return (
      fresh.find(
        (r) => r.kind === kind && (r.data.id ?? r.data.sourceId) === id,
      ) ?? null
    );
  }
  private data<T>(record: DiskRecord | null): T | null {
    if (!record) return null;
    const data = structuredClone(record.data);
    if (record.kind === "knowledge") data.path = record.path;
    return data as T;
  }
  private async list<T>(kind: Kind): Promise<T[]> {
    return (await this.records())
      .filter((r) => r.kind === kind)
      .map((r) => this.data<T>(r)!);
  }
  private defaultPath(kind: Kind, data: RecordData): string {
    const id = data.id ?? data.sourceId;
    safeId(id);
    if (["source", "transcript", "reflection"].includes(kind))
      return `sources/youtube/${id.slice(8)}/${kind}.md`;
    if (kind === "knowledge" && data.path) {
      this.relative(data.path);
      if (
        !data.path.startsWith("knowledge/") ||
        !data.path.endsWith(".md") ||
        data.path.split("/").some((part: string) => part.startsWith("."))
      )
        throw new VaultError(
          "Knowledge path must be Markdown inside knowledge/",
          "PATH_UNSAFE",
        );
      return data.path;
    }
    const folder = (
      {
        knowledge: "knowledge",
        document: "documents",
        proposal: "proposals",
        timeline: "history",
        "agent-run": "agent-runs",
      } as Partial<Record<Kind, string>>
    )[kind];
    if (!folder) throw new VaultError("No default folder for this record kind");
    return `${folder}/${id.replace(/:/g, "_")}.md`;
  }
  private async prepare(kind: Kind, data: RecordData, records?: DiskRecord[]) {
    validate(kind, data);
    // Validate caller path even when an existing ID makes it unnecessary.
    const proposed = this.defaultPath(kind, data);
    const all = records ?? (await this.records());
    let old = all.find(
      (r) =>
        r.kind === kind &&
        (r.data.id ?? r.data.sourceId) === (data.id ?? data.sourceId),
    );
    if (this.options.cache && old && !records) {
      old =
        (await this.lookup(kind, data.id ?? data.sourceId, true)) ?? undefined;
    }
    const relative = old?.path ?? proposed;
    const occupant = all.find((r) => r.path === relative);
    if (
      occupant &&
      this.identity(occupant) !== `${kind}:${data.id ?? data.sourceId}`
    )
      throw new VaultError("Target path belongs to another record", "CONFLICT");
    const stat = await exists(await this.checked(relative, true));
    if (stat && !old)
      throw new VaultError(
        "Refusing to overwrite an existing file",
        "CONFLICT",
      );
    return { relative, text: serializeMarkdown(kind, data, old?.extra), old };
  }
  private async save(kind: Kind, data: RecordData): Promise<string> {
    this.ready();
    return this.exclusive(async () => {
      const p = await this.prepare(kind, data);
      await this.atomic(p.relative, p.text);
      return p.relative;
    });
  }
  listSources() {
    return this.list<Source>("source");
  }
  async getSource(id: string) {
    return this.data<Source>(await this.lookup("source", id));
  }
  saveSource(source: Source) {
    return this.save("source", source);
  }
  async saveImage(bytes: Uint8Array, extension: "jpg" | "png" | "webp") {
    this.ready();
    if (
      !bytes.length ||
      bytes.length > 1024 * 1024 ||
      !["jpg", "png", "webp"].includes(extension)
    )
      throw new VaultError("Invalid image", "TOO_LARGE");
    const file = `assets/${createHash("sha256").update(bytes).digest("hex")}.${extension}`;
    await this.exclusive(async () => {
      await this.atomic(file, bytes);
    });
    return file;
  }
  async readImage(file: string): Promise<Uint8Array> {
    this.ready();
    if (!/^assets\/[a-f0-9]{64}\.(?:jpg|png|webp)$/.test(file))
      throw new VaultError("Invalid image path", "PATH_UNSAFE");
    const handle = await fs.open(
      await this.checked(file),
      constants.O_RDONLY | constants.O_NOFOLLOW,
    );
    try {
      const stat = await handle.stat();
      if (!stat.isFile() || stat.nlink !== 1 || stat.size > 1024 * 1024)
        throw new VaultError("Unsafe image", "PATH_UNSAFE");
      const bytes = Buffer.alloc(1024 * 1024 + 1);
      let count = 0;
      while (count < bytes.length) {
        const { bytesRead } = await handle.read(
          bytes,
          count,
          bytes.length - count,
          null,
        );
        if (!bytesRead) break;
        count += bytesRead;
      }
      if (count > 1024 * 1024)
        throw new VaultError("Image exceeds size limit", "TOO_LARGE");
      return bytes.subarray(0, count);
    } finally {
      await handle.close();
    }
  }
  /** One scan per import batch; existing sources and decisions are untouched.
   * Writes are individually atomic, so replay after interruption is safe. */
  async addNewSources(sources: Source[], enrich = false): Promise<string[]> {
    this.ready();
    return this.exclusive(async () => {
      const records = structuredClone(await this.records());
      const known = new Set(
        records.filter((r) => r.kind === "source").map((r) => r.data.id),
      );
      const writes = [];
      const added: string[] = [];
      for (const source of sources) {
        validate("source", source);
        if (known.has(source.id)) {
          const record = records.find(
            (r) => r.kind === "source" && r.data.id === source.id,
          );
          if (!enrich || !record) continue;
          const updated = { ...record.data } as Source;
          if (!updated.channel && source.channel)
            updated.channel = source.channel;
          if (!updated.channelUrl && source.channelUrl)
            updated.channelUrl = source.channelUrl;
          for (const [url, file] of [
            ["thumbnailUrl", "thumbnailPath"],
            ["channelAvatarUrl", "channelAvatarPath"],
          ] as const) {
            if (source[url] && source[url] !== updated[url]) {
              updated[url] = source[url];
              delete updated[file];
            }
          }
          if (JSON.stringify(updated) !== JSON.stringify(record.data)) {
            writes.push({
              id: source.id,
              ...(await this.prepare("source", updated, records)),
            });
            record.data = updated; // this batch has its own copy of the catalog
          }
          continue;
        }
        writes.push({
          id: source.id,
          ...(await this.prepare("source", source, records)),
        });
        known.add(source.id);
        added.push(source.id);
      }
      for (const write of writes) await this.atomic(write.relative, write.text);
      return added;
    });
  }
  async getTranscript(id: string) {
    return this.data<Transcript>(await this.lookup("transcript", id));
  }
  saveTranscript(transcript: Transcript) {
    return this.save("transcript", transcript);
  }
  async getReflection(id: string) {
    return this.data<Reflection>(await this.lookup("reflection", id));
  }
  saveReflection(reflection: Reflection) {
    return this.save("reflection", reflection);
  }
  listKnowledge() {
    return this.list<KnowledgeNote>("knowledge");
  }
  async getKnowledge(id: string) {
    return this.data<KnowledgeNote>(await this.lookup("knowledge", id));
  }
  saveKnowledge(note: KnowledgeNote) {
    return this.save("knowledge", note);
  }
  listProposals() {
    return this.list<SynthesisProposal>("proposal");
  }
  async getProposal(id: string) {
    return this.data<SynthesisProposal>(await this.lookup("proposal", id));
  }
  saveProposal(proposal: SynthesisProposal) {
    return this.save("proposal", proposal);
  }
  async appendTimeline(event: TimelineEvent): Promise<string> {
    this.ready();
    return this.exclusive(async () => {
      const old = await this.lookup("timeline", event.id, true);
      if (old) {
        if (
          serializeMarkdown("timeline", old.data) !==
          serializeMarkdown("timeline", event)
        )
          throw new VaultError("Timeline events are immutable", "CONFLICT");
        return old.path;
      }
      const p = await this.prepare("timeline", event);
      await this.atomic(p.relative, p.text);
      return p.relative;
    });
  }
  async listTimeline() {
    return (await this.list<TimelineEvent>("timeline")).sort(
      (a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id),
    );
  }
  saveAudit(audit: AgentAudit) {
    return this.save("agent-run", audit);
  }
  async importDocument(input: {
    title: string;
    markdown: string;
    filename?: string;
  }): Promise<{ id: string; path: string }> {
    const id = `document:${randomUUID()}`;
    const relative = await this.save("document", {
      id,
      title: input.title,
      markdown: input.markdown,
      originalFilename: input.filename ?? "",
      importedAt: new Date().toISOString(),
      contentHash: hash(input.markdown),
    });
    return { id, path: relative };
  }
  async applyKnowledgeBatch(
    changes: Array<{ note: KnowledgeNote; expectedBefore: string | null }>,
  ): Promise<string[]> {
    this.ready();
    return this.exclusive(async () => {
      const all = await this.records(true);
      const ids = new Set();
      const paths = new Set();
      const prepared = [];
      for (const { note, expectedBefore } of changes) {
        const p = await this.prepare("knowledge", note, all);
        if (ids.has(note.id) || paths.has(p.relative))
          throw new VaultError("Duplicate batch target", "CONFLICT");
        ids.add(note.id);
        paths.add(p.relative);
        if (
          expectedBefore === null
            ? !!p.old
            : !p.old || p.old.data.markdown !== expectedBefore
        )
          throw new VaultError(
            "Knowledge changed since proposal creation",
            "CONFLICT",
          );
        prepared.push(p);
      }
      // Stage every serialization before publishing anything; each replacement is atomic.
      // This is not a multi-file filesystem transaction. Callers retain the accepted
      // proposal for recovery if storage fails during publication.
      const staged: string[] = [];
      try {
        for (const p of prepared)
          staged.push(await this.stage(p.relative, p.text));
        // Catch manual edits occurring during preparation before the first publication.
        for (const p of prepared) {
          if (p.old) {
            const current = parseMarkdown(await this.read(p.relative));
            if (
              !current ||
              current.data.id !== p.old.data.id ||
              current.data.markdown !== p.old.data.markdown
            )
              throw new VaultError(
                "Knowledge changed during batch preparation",
                "CONFLICT",
              );
          } else if (await exists(await this.checked(p.relative)))
            throw new VaultError(
              "Knowledge target appeared during batch preparation",
              "CONFLICT",
            );
        }
        for (let i = 0; i < prepared.length; i++)
          await this.publish(staged[i]!, prepared[i]!.relative);
      } finally {
        for (const temp of staged)
          await fs.unlink(this.relative(temp)).catch(() => {});
      }
      return prepared.map((p) => p.relative);
    });
  }
  async scan(): Promise<VaultScanEntry[]> {
    return (await this.records())
      .filter((r) =>
        [
          "knowledge",
          "source",
          "transcript",
          "reflection",
          "document",
        ].includes(r.kind),
      )
      .map((r) => {
        const d = r.data;
        const type = r.kind as VaultScanEntry["type"];
        const entry: VaultScanEntry = {
          id: d.id ?? `${r.kind}:${d.sourceId}`,
          type,
          title: d.title ?? `${r.kind}: ${d.sourceId}`,
          path: r.path,
          markdown: r.body,
        };
        if (r.kind === "source") entry.sourceId = d.id;
        if (r.kind === "reflection" || r.kind === "transcript")
          entry.sourceId = d.sourceId;
        if (r.kind === "reflection")
          entry.markdown = `${d.why}\n\n${d.reaction}\n\n${d.questions}\n\n${d.selectedPassages.map((p: RecordData) => p.text).join("\n")}`;
        if (r.kind === "transcript") entry.segments = d.segments;
        return entry;
      });
  }
}
