import { expect, test } from "bun:test";
import {
  mkdtemp,
  rm,
  stat,
  symlink,
  readFile,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { TraceStore } from "./traces";

test("traces retain ordered messages and errors, redact credentials and restrict file access", async () => {
  const root = await mkdtemp(join(tmpdir(), "kb-traces-"));
  try {
    const store = new TraceStore(root, () => ["private-model-key"]);
    const trace = await store.create();
    await Promise.all([
      trace.append("request", {
        apiKey: "another-key",
        messages: [{ content: "Use private-model-key" }],
      }),
      trace.append(
        "error",
        new Error("Authorization: Bearer other-token private-model-key"),
      ),
    ]);
    const events = await store.read(trace.id);
    expect(events.map((e) => e.type)).toEqual(["request", "error"]);
    expect(JSON.stringify(events)).not.toContain("private-model-key");
    expect(JSON.stringify(events)).not.toContain("another-key");
    expect(JSON.stringify(events)).not.toContain("other-token");
    expect(JSON.stringify(events)).toContain("stack");
    expect(
      (await stat(join(root, ".kb/traces", trace.id + ".jsonl"))).mode & 0o777,
    ).toBe(0o600);
    await expect(store.read("../settings")).rejects.toThrow();
    const outside = join(root, "outside");
    await writeFile(outside, "private");
    const path = join(root, ".kb/traces", trace.id + ".jsonl");
    await rm(path);
    await symlink(outside, path);
    await expect(store.read(trace.id)).rejects.toThrow();
    await expect(trace.append("new", {})).rejects.toThrow();
    expect(await readFile(outside, "utf8")).toBe("private");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
