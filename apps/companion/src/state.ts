import {
  lstat,
  mkdir,
  readFile,
  rename,
  writeFile,
  chmod,
  unlink,
} from "node:fs/promises";
import { join } from "node:path";
import type { AppSettings, Job, ModelConfig } from "@repo/kb-shared";
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new ApiError(400, "Expected an object");
  return value as Record<string, unknown>;
}
export function string(
  value: unknown,
  name: string,
  allowEmpty = false,
): string {
  if (typeof value !== "string" || (!allowEmpty && !value.trim()))
    throw new ApiError(400, `Invalid ${name}`);
  return value;
}
export function id(value: string): string {
  if (!/^[a-z][a-z0-9_-]*:[A-Za-z0-9_-]+(?::[A-Za-z0-9_-]+)*$/.test(value))
    throw new ApiError(400, "Invalid identifier");
  return value;
}
export class State {
  settings: AppSettings;
  jobs: Job[] = [];
  constructor(readonly root: string) {
    this.settings = {
      vaultPath: root,
      inference: { baseUrl: "http://127.0.0.1:11434/v1", model: "" },
      embeddings: { baseUrl: "http://127.0.0.1:11434/v1", model: "" },
      gitAutoCommit: false,
      network: { youtube: true, inference: true, embeddings: false },
    };
  }
  async path(filename: string) {
    if (!/^[a-z-]+\.(json|sqlite|lock)$/.test(filename))
      throw new Error("Invalid state filename");
    const dir = join(this.root, ".kb");
    await mkdir(dir, { recursive: true, mode: 0o700 });
    if ((await lstat(dir)).isSymbolicLink())
      throw new Error("Unsafe state directory");
    const path = join(dir, filename);
    try {
      const stat = await lstat(path);
      if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1)
        throw new Error("Unsafe state file");
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
    }
    return path;
  }
  async load(recoverJobs = true) {
    for (const name of ["settings", "jobs"] as const) {
      try {
        const parsed = JSON.parse(
          await readFile(await this.path(`${name}.json`), "utf8"),
        );
        if (name === "settings") this.settings = this.merge(parsed);
        else {
          if (!Array.isArray(parsed)) throw new Error("Invalid jobs");
          this.jobs = parsed;
        }
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
      }
    }
    if (!recoverJobs) return;
    for (const job of this.jobs)
      if (job.state === "running" || job.state === "queued") {
        job.state = "failed";
        job.error = "Interrupted by companion restart; retry operation";
        job.updatedAt = new Date().toISOString();
      }
    await this.saveJobs();
  }
  private async write(name: string, value: unknown) {
    const path = await this.path(`${name}.json`);
    const temp = `${path}.${crypto.randomUUID()}.tmp`;
    await writeFile(temp, JSON.stringify(value, null, 2), {
      mode: 0o600,
      flag: "wx",
    });
    await rename(temp, path);
    await chmod(path, 0o600);
  }
  async readDocument(name: string): Promise<unknown | null> {
    try {
      return JSON.parse(
        await readFile(await this.path(`${name}.json`), "utf8"),
      );
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
  }
  async writeDocument(name: string, value: unknown) {
    await this.write(name, value);
  }
  async removeDocument(name: string) {
    await unlink(await this.path(`${name}.json`));
  }
  async saveJobs() {
    await this.write("jobs", this.jobs);
  }
  merge(value: unknown): AppSettings {
    const patch = object(value),
      next = structuredClone(this.settings);
    for (const key of ["inference", "embeddings"] as const)
      if (patch[key] !== undefined) {
        const config = object(patch[key]);
        for (const field of ["baseUrl", "model", "apiKey"] as const)
          if (config[field] !== undefined) {
            const text = string(config[field], field, true);
            if (field !== "apiKey" || text) next[key][field] = text;
          }
        if (config.contextWindow !== undefined) {
          if (
            !Number.isInteger(config.contextWindow) ||
            Number(config.contextWindow) < 4096 ||
            Number(config.contextWindow) > 2_000_000
          )
            throw new ApiError(400, "Invalid context window");
          next[key].contextWindow = Number(config.contextWindow);
        }
        if (next[key].baseUrl) {
          let url: URL;
          try {
            url = new URL(next[key].baseUrl);
          } catch {
            throw new ApiError(400, "Invalid model URL");
          }
          if (
            !["http:", "https:"].includes(url.protocol) ||
            url.username ||
            url.password ||
            url.search ||
            url.hash
          )
            throw new ApiError(400, "Invalid model URL");
        }
      }
    if (patch.gitAutoCommit !== undefined) {
      if (typeof patch.gitAutoCommit !== "boolean")
        throw new ApiError(400, "Invalid Git setting");
      next.gitAutoCommit = patch.gitAutoCommit;
    }
    if (patch.network !== undefined) {
      const network = object(patch.network);
      for (const key of ["youtube", "inference", "embeddings"] as const)
        if (network[key] !== undefined) {
          if (typeof network[key] !== "boolean")
            throw new ApiError(400, "Invalid network setting");
          next.network[key] = network[key] as boolean;
        }
    }
    next.vaultPath = this.root;
    return next;
  }
  async update(value: unknown) {
    const next = this.merge(value);
    await this.write("settings", next);
    this.settings = next;
    return this.redacted();
  }
  redacted(): AppSettings {
    const next = structuredClone(this.settings);
    delete next.inference.apiKey;
    delete next.embeddings.apiKey;
    return next;
  }
}
