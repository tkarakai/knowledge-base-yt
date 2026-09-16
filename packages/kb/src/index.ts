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
  constructor(root: string) {
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
      const bytes = Buffer.alloc(MAX_FILE_BYTES + 1);
      let count = 0;
      while (count < bytes.length) {
        const r = await handle.read(bytes, count, bytes.length - count, null);
        if (!r.bytesRead) break;
        count += r.bytesRead;
      }
      if (count > MAX_FILE_BYTES)
        throw new VaultError("Markdown exceeds size limit", "TOO_LARGE");
      await this.checked(relative);
      return bytes.subarray(0, count).toString("utf8");
    } finally {
      await handle.close();
    }
  }
  private async stage(relative: string, text: string): Promise<string> {
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
  }
  private async atomic(relative: string, text: string) {
    const temporary = await this.stage(relative, text);
    try {
      await this.publish(temporary, relative);
    } finally {
      await fs.unlink(this.relative(temporary)).catch(() => {});
    }
  }
  private async records(): Promise<DiskRecord[]> {
    this.ready();
    await this.directory(this.root);
    const result: DiskRecord[] = [];
    const identities = new Set<string>();
    let count = 0;
    const walk = async (relative: string, depth: number) => {
      if (depth > 32)
        throw new VaultError(
          "Vault exceeds directory depth limit",
          "TOO_LARGE",
        );
      const absolute = relative ? this.relative(relative) : this.root;
      await this.directory(absolute);
      const entries = (
        await fs.readdir(absolute, { withFileTypes: true })
      ).sort((a, b) => a.name.localeCompare(b.name));
      for (const entry of entries) {
        if (
          entry.name.startsWith(".") ||
          entry.name === "node_modules" ||
          entry.name === ".git"
        )
          continue;
        const file = relative ? `${relative}/${entry.name}` : entry.name;
        if (++count > 100000)
          throw new VaultError("Vault exceeds scan entry limit", "TOO_LARGE");
        if (entry.isSymbolicLink())
          throw new VaultError(
            "Symlinks are forbidden in the vault",
            "PATH_UNSAFE",
          );
        if (entry.isDirectory()) {
          await walk(file, depth + 1);
          continue;
        }
        if (!entry.name.toLowerCase().endsWith(".md")) continue;
        const parsed = parseMarkdown(await this.read(file));
        if (!parsed) continue;
        const id = parsed.data.id ?? parsed.data.sourceId;
        const identity = `${parsed.kind}:${id}`;
        if (identities.has(identity))
          throw new VaultError(
            `Duplicate ${parsed.kind} ID: ${id}`,
            "CONFLICT",
          );
        identities.add(identity);
        result.push({ ...parsed, path: file });
      }
    };
    await walk("", 0);
    return result;
  }
  private async lookup(kind: Kind, id: string): Promise<DiskRecord | null> {
    safeId(id);
    return (
      (await this.records()).find(
        (r) => r.kind === kind && (r.data.id ?? r.data.sourceId) === id,
      ) ?? null
    );
  }
  private data<T>(record: DiskRecord | null): T | null {
    if (!record) return null;
    const data = { ...record.data };
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
    const old = all.find(
      (r) =>
        r.kind === kind &&
        (r.data.id ?? r.data.sourceId) === (data.id ?? data.sourceId),
    );
    const relative = old?.path ?? proposed;
    const occupant = all.find((r) => r.path === relative);
    if (occupant && occupant !== old)
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
      const old = await this.lookup("timeline", event.id);
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
      const all = await this.records();
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
