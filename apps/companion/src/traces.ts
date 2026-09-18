import { constants } from "node:fs";
import { lstat, mkdir, open, readdir, unlink } from "node:fs/promises";
import { join } from "node:path";
import type { RunTraceEvent } from "@repo/kb-shared";

const MAX_TRACE = 20 * 1024 * 1024;
const MAX_EVENT = 2 * 1024 * 1024;
const TRACE_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export function redact(value: unknown, secrets: string[]): unknown {
  const text = (input: string) => {
    let result = input;
    for (const secret of secrets.filter(Boolean))
      result = result.split(secret).join("[redacted]");
    return result
      .replace(/Bearer\s+[^\s"\\]+/gi, "Bearer [redacted]")
      .replace(
        /([?&](?:key|api_key|token|pot|signature|sig|expire)=)[^&\s"\\]+/gi,
        "$1[redacted]",
      );
  };
  if (typeof value === "string") return text(value);
  if (value instanceof Error)
    return {
      name: value.name,
      message: text(value.message),
      stack: text(value.stack ?? ""),
    };
  if (Array.isArray(value)) return value.map((item) => redact(item, secrets));
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        /^(authorization|cookie|set-cookie|api[-_]?key|access[-_]?token|refresh[-_]?token)$/i.test(
          key,
        )
          ? "[redacted]"
          : redact(item, secrets),
      ]),
    );
  return value;
}
export class TraceStore {
  constructor(
    private root: string,
    private secrets: () => string[],
  ) {}
  private async directory() {
    const parent = join(this.root, ".kb");
    await mkdir(parent, { recursive: true, mode: 0o700 });
    if ((await lstat(parent)).isSymbolicLink())
      throw new Error("Unsafe trace parent");
    const directory = join(parent, "traces");
    await mkdir(directory, { recursive: true, mode: 0o700 });
    if ((await lstat(directory)).isSymbolicLink())
      throw new Error("Unsafe trace directory");
    return directory;
  }
  async create() {
    const directory = await this.directory();
    // Keep the newest 100 runs. Deletion never follows links or touches other files.
    const old = await Promise.all(
      (await readdir(directory))
        .filter((n) => n.endsWith(".jsonl") && TRACE_ID.test(n.slice(0, -6)))
        .map(async (name) => ({
          name,
          stat: await lstat(join(directory, name)),
        })),
    );
    old.sort((a, b) => b.stat.mtimeMs - a.stat.mtimeMs);
    for (const file of old.slice(99))
      if (file.stat.isFile() && !file.stat.isSymbolicLink())
        await unlink(join(directory, file.name));
    const id = crypto.randomUUID();
    const path = join(directory, `${id}.jsonl`);
    const initial = await open(path, "wx", 0o600);
    await initial.close();
    let bytes = 0;
    let limited = false;
    let pending = Promise.resolve();
    const append = (type: string, data: unknown): Promise<void> => {
      const write = async () => {
        if (limited) return;
        let event: RunTraceEvent = {
          at: new Date().toISOString(),
          type,
          data: redact(data, this.secrets()),
        };
        let line = JSON.stringify(event) + "\n";
        if (Buffer.byteLength(line) > MAX_EVENT) {
          event = {
            ...event,
            data: {
              truncated: true,
              originalBytes: Buffer.byteLength(line),
              preview: JSON.stringify(event.data).slice(0, 100_000),
            },
          };
          line = JSON.stringify(event) + "\n";
        }
        if (bytes + Buffer.byteLength(line) > MAX_TRACE) {
          line =
            JSON.stringify({
              at: event.at,
              type: "trace_limit",
              data: {
                message: "Trace exceeded 20 MiB; further events omitted.",
              },
            }) + "\n";
          limited = true;
        }
        const file = await open(
          path,
          constants.O_WRONLY | constants.O_APPEND | constants.O_NOFOLLOW,
        );
        try {
          const stat = await file.stat();
          if (!stat.isFile() || stat.nlink !== 1)
            throw new Error("Unsafe trace file");
          await file.writeFile(line);
          bytes += Buffer.byteLength(line);
        } finally {
          await file.close();
        }
      };
      pending = pending.then(write);
      return pending;
    };
    return { id, append };
  }
  async read(id: string): Promise<RunTraceEvent[]> {
    if (!TRACE_ID.test(id)) throw new Error("Invalid trace identifier");
    const path = join(await this.directory(), `${id}.jsonl`);
    const file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
    try {
      const stat = await file.stat();
      if (!stat.isFile() || stat.nlink !== 1 || stat.size > MAX_TRACE + 4096)
        throw new Error("Unsafe trace file");
      return (await file.readFile("utf8"))
        .split("\n")
        .filter(Boolean)
        .flatMap((line) => {
          try {
            return [JSON.parse(line) as RunTraceEvent];
          } catch {
            return [];
          } // Tolerate a final interrupted write.
        });
    } finally {
      await file.close();
    }
  }
}
