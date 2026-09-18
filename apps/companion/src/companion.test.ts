import { afterEach, describe, expect, test } from "bun:test";
import {
  mkdir,
  rename,
  mkdtemp,
  realpath,
  readFile,
  rm,
  writeFile,
  readdir,
  symlink,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createCompanion, commitAccepted } from "./index";
import { SynthesisError } from "@repo/kb-agent";
import type { SynthesisProposal } from "@repo/kb-shared";
const token = "test-companion-token-32-characters";
const sourceId = "youtube:dQw4w9WgXcQ";
const roots: string[] = [];
const apps: Awaited<ReturnType<typeof createCompanion>>[] = [];
afterEach(async () => {
  for (const app of apps.splice(0)) app.close();
  for (const root of roots.splice(0))
    await rm(root, { recursive: true, force: true });
});
async function setup(
  synthesize?: Parameters<typeof createCompanion>[0]["synthesize"],
) {
  const root = await mkdtemp(join(await realpath(tmpdir()), "companion-test-"));
  roots.push(root);
  const app = await createCompanion({
    synthesize,
    vaultPath: root,
    token,
    media: { background: false },
    metadata: async (videoId) => ({
      videoId,
      url: `https://www.youtube.com/watch?v=${videoId}`,
      title: "CRDT talk",
      channel: "Fixture",
    }),
    transcriptProvider: {
      fetch: async () => ({
        sourceId,
        language: "en",
        provider: "fixture",
        generated: null,
        status: "requires_user_action",
        segments: [],
        error: "Paste transcript",
      }),
    },
  });
  apps.push(app);
  return app;
}
function request(
  app: Awaited<ReturnType<typeof createCompanion>>,
  path: string,
  method = "GET",
  data?: unknown,
  headers: Record<string, string> = {},
) {
  return app.fetch(
    new Request(`http://127.0.0.1:4317${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...headers,
      },
      body: data === undefined ? undefined : JSON.stringify(data),
    }),
  );
}
async function ingest(app: Awaited<ReturnType<typeof createCompanion>>) {
  const response = await request(app, "/sources", "POST", {
    url: "https://youtu.be/dQw4w9WgXcQ",
  });
  expect(response.status).toBe(200);
  return response.json();
}
function proposal(
  id = "proposal:one",
  knowledgeId = "knowledge:crdt",
): SynthesisProposal {
  return {
    id,
    sourceId,
    createdAt: new Date().toISOString(),
    model: "fixture",
    summary: "Extend knowledge",
    whyItMatters: "Convergence",
    outcome: "changes",
    changes: [
      {
        id: "change:one",
        operation: "create_note",
        knowledgeId,
        title: "CRDT",
        before: "",
        after: "# CRDT\n\nReplicas converge.",
        rationale: "From selected passage",
        evidence: [{ sourceId, start: 60, end: 75 }],
        decision: "pending",
      },
    ],
    questions: [],
    status: "pending",
  };
}
describe("companion HTTP and integration", () => {
  test("model connection checks use saved or draft credentials without saving and respect network permissions", async () => {
    const app = await setup();
    const calls: Array<{
      path: string;
      authorization: string | null;
      body: Record<string, unknown>;
    }> = [];
    let status = 200;
    const provider = Bun.serve({
      hostname: "127.0.0.1",
      port: 0,
      async fetch(request) {
        const path = new URL(request.url).pathname;
        calls.push({
          path,
          authorization: request.headers.get("authorization"),
          body: (await request.json()) as Record<string, unknown>,
        });
        if (status !== 200)
          return Response.json(
            { error: "saved-secret must never reach the browser" },
            { status },
          );
        return Response.json(
          path.endsWith("/embeddings")
            ? { data: [{ embedding: [0.1, 0.2, 0.3] }] }
            : { choices: [{ message: { role: "assistant", content: "OK" } }] },
        );
      },
    });
    try {
      const config = {
        baseUrl: `http://127.0.0.1:${provider.port}/v1`,
        model: "saved-model",
        apiKey: "saved-secret",
      };
      await app.state.update({ inference: config, embeddings: config });
      const before = structuredClone(app.state.settings);
      expect(
        (
          await request(app, "/settings/inference/check", "POST", {
            apiKey: "",
            model: "draft-model",
          })
        ).status,
      ).toBe(200);
      expect(calls[0]).toMatchObject({
        path: "/v1/chat/completions",
        authorization: "Bearer saved-secret",
        body: {
          model: "draft-model",
          messages: [{ role: "user", content: "Reply with OK." }],
        },
      });
      expect(
        (await request(app, "/settings/embeddings/check", "POST", {})).status,
      ).toBe(409);
      expect(calls).toHaveLength(1);
      expect(app.state.settings).toEqual(before);
      expect(
        JSON.parse(
          await readFile(join(app.vault.root, ".kb/settings.json"), "utf8"),
        ),
      ).toEqual(before);

      await app.state.update({ network: { embeddings: true } });
      expect(
        (
          await request(app, "/settings/embeddings/check", "POST", {
            apiKey: "replacement-secret",
          })
        ).status,
      ).toBe(200);
      expect(calls[1]).toMatchObject({
        path: "/v1/embeddings",
        authorization: "Bearer replacement-secret",
        body: { model: "saved-model", input: ["Connection test."] },
      });
      expect(app.state.settings.embeddings.apiKey).toBe("saved-secret");
      for (const failure of [401, 403, 404, 429, 500]) {
        status = failure;
        const response = await request(
          app,
          "/settings/inference/check",
          "POST",
          {},
        );
        expect(response.status).toBe(502);
        const text = await response.text();
        expect(text).toContain(`HTTP ${failure}`);
        expect(text).not.toContain("saved-secret");
      }
      const count = calls.length;
      expect(
        (
          await request(app, "/settings/inference/check", "POST", {
            baseUrl: "file:///tmp/key",
          })
        ).status,
      ).toBe(400);
      expect(
        (await request(app, "/settings/inference/check", "POST", { model: "" }))
          .status,
      ).toBe(400);
      expect(calls).toHaveLength(count);
    } finally {
      provider.stop(true);
    }
  });

  test("all workspace settings and hidden keys survive reload and restart", async () => {
    const app = await setup();
    const values = {
      inference: {
        baseUrl: "https://reasoning.example/v1",
        model: "reasoning-model",
        apiKey: "reasoning-secret",
        contextWindow: 32768,
      },
      embeddings: {
        baseUrl: "https://embeddings.example/v1",
        model: "embedding-model",
        apiKey: "embedding-secret",
      },
      network: { youtube: false, inference: false, embeddings: true },
      gitAutoCommit: true,
    };
    const saved = await request(app, "/settings", "PUT", values);
    expect(saved.status).toBe(200);
    const publicSettings = await saved.json();
    for (const key of ["inference", "embeddings"] as const) {
      expect(publicSettings[key].apiKeyConfigured).toBe(true);
      expect(publicSettings[key].apiKey).toBeUndefined();
    }
    expect(await (await request(app, "/settings")).json()).toEqual(
      publicSettings,
    );

    // The UI sends empty password fields when saving unrelated changes.
    const preserved = await request(app, "/settings", "PUT", {
      ...publicSettings,
      inference: { ...publicSettings.inference, apiKey: "" },
      embeddings: { ...publicSettings.embeddings, apiKey: "" },
    });
    expect(preserved.status).toBe(200);
    const restart = await createCompanion({
      vaultPath: app.vault.root,
      token,
      media: { background: false },
    });
    apps.push(restart);
    expect(restart.state.settings).toEqual({
      ...values,
      vaultPath: app.vault.root,
    });
    expect(await (await request(restart, "/settings")).json()).toEqual(
      publicSettings,
    );
  });

  test("clearing the optional context window persists without clearing the saved key", async () => {
    const app = await setup();
    const initial = await (await request(app, "/settings")).json();
    expect(initial.inference.apiKeyConfigured).toBe(false);
    expect(initial.embeddings.apiKeyConfigured).toBe(false);
    await request(app, "/settings", "PUT", {
      inference: { apiKey: "saved-secret", contextWindow: 32768 },
    });
    const response = await request(app, "/settings", "PUT", {
      inference: { apiKey: "", contextWindow: null },
    });
    expect(response.status).toBe(200);
    expect((await response.json()).inference.contextWindow).toBeUndefined();
    const restart = await createCompanion({
      vaultPath: app.vault.root,
      token,
      media: { background: false },
    });
    apps.push(restart);
    expect(restart.state.settings.inference.contextWindow).toBeUndefined();
    expect(restart.state.settings.inference.apiKey).toBe("saved-secret");
  });

  test("token, Origin, Host, traversal and body limits on actual HTTP", async () => {
    const app = await setup();
    expect(
      (
        await request(app, "/health", "GET", undefined, {
          Authorization: "bad",
        })
      ).status,
    ).toBe(401);
    expect(
      (
        await request(app, "/health", "GET", undefined, {
          Origin: "https://evil.test",
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await request(app, "/health", "GET", undefined, {
          Host: "evil.test:4317",
        })
      ).status,
    ).toBe(403);
    expect(
      (await request(app, "/knowledge/knowledge%3A..%2Fsecret")).status,
    ).toBe(400);
    expect(
      (
        await request(app, "/documents", "POST", {
          title: "large",
          markdown: "a".repeat(2 * 1024 * 1024),
        })
      ).status,
    ).toBe(413);
    const isolated = await createCompanion({
      vaultPath: app.vault.root,
      token,
      port: 0,
    });
    apps.push(isolated);
    const server = isolated.start();
    try {
      expect(server.hostname).toBe("127.0.0.1");
      const actual = await fetch(`http://127.0.0.1:${server.port}/health`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(actual.status).toBe(200);
      expect((await actual.json()).ok).toBe(true);
      const imported = await fetch(
        `http://127.0.0.1:${server.port}/documents`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            title: "HTTP document",
            markdown: "HTTP-roundtrip searchable content",
          }),
        },
      );
      expect(imported.status).toBe(200);
      const importedId = (await imported.json()).id;
      const opened = await fetch(
        `http://127.0.0.1:${server.port}/documents/${encodeURIComponent(importedId)}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      expect(opened.status).toBe(200);
      expect((await opened.json()).markdown).toContain("HTTP-roundtrip");
      const search = await fetch(
        `http://127.0.0.1:${server.port}/search?q=HTTP-roundtrip`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      expect((await search.json())[0].type).toBe("document");
      const oversized = await fetch(
        `http://127.0.0.1:${server.port}/documents`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            title: "large",
            markdown: "a".repeat(2 * 1024 * 1024),
          }),
        },
      );
      expect(oversized.status).toBe(413);
      expect(
        (await fetch(`http://127.0.0.1:${server.port}/health`)).status,
      ).toBe(401);
    } finally {
      server.stop(true);
    }
  });
  test("ingest, manual timestamps, keep/ignore gates, durable settings and restart", async () => {
    const app = await setup();
    const detail = await ingest(app);
    expect(detail.source.transcriptStatus).toBe("requires_user_action");
    expect(
      (
        await request(app, `/sources/${sourceId}/transcript`, "PUT", {
          text: "[01:00] Replicas converge.\n[01:15] Without central coordination.",
        })
      ).status,
    ).toBe(200);
    expect(
      (await request(app, `/sources/${sourceId}/synthesize`, "POST")).status,
    ).toBe(409);
    const reflection = {
      decision: "ignore",
      why: "not useful",
      reaction: "",
      questions: "",
      selectedPassages: [{ start: 60, end: 75, text: "Replicas converge." }],
    };
    expect(
      (await request(app, `/sources/${sourceId}/reflection`, "PUT", reflection))
        .status,
    ).toBe(200);
    expect(
      (await request(app, `/sources/${sourceId}/synthesize`, "POST")).status,
    ).toBe(409);
    const settings = await request(app, "/settings", "PUT", {
      inference: { apiKey: "top-secret", model: "fixture" },
      network: { youtube: false, embeddings: false },
    });
    expect(JSON.stringify(await settings.json())).not.toContain("top-secret");
    await request(app, "/settings", "PUT", { inference: { apiKey: "" } });
    expect(app.state.settings.inference.apiKey).toBe("top-secret");
    app.state.jobs.push({
      id: "job:interrupted",
      type: "run_synthesis",
      state: "running",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    await app.state.saveJobs();
    const restart = await createCompanion({ vaultPath: app.vault.root, token });
    apps.push(restart);
    const restored = await (
      await request(restart, `/sources/${sourceId}`)
    ).json();
    expect(restored.transcript.segments[0].start).toBe(60);
    expect(restored.reflection.selectedPassages).toHaveLength(1);
    expect(restart.state.settings.inference.apiKey).toBe("top-secret");
    expect(
      restart.state.jobs.find((j) => j.id === "job:interrupted")?.state,
    ).toBe("failed");
  });
  test("rejection leaves knowledge untouched; acceptance retains edited text and provenance", async () => {
    const app = await setup();
    await ingest(app);
    await app.vault.saveProposal(proposal());
    const before = await readdir(join(app.vault.root, "knowledge"));
    const rejected = await request(
      app,
      "/proposals/proposal:one/review",
      "POST",
      { decisions: [{ changeId: "change:one", action: "reject" }] },
    );
    expect(rejected.status).toBe(200);
    expect(await readdir(join(app.vault.root, "knowledge"))).toEqual(before);
    expect(await app.vault.listKnowledge()).toHaveLength(0);
    await app.vault.saveProposal(proposal("proposal:two"));
    const accepted = await request(
      app,
      "/proposals/proposal:two/review",
      "POST",
      {
        decisions: [
          {
            changeId: "change:one",
            action: "accept",
            markdown: "# User edit\n\nConvergent replicas.",
          },
        ],
      },
    );
    expect(accepted.status).toBe(200);
    const note = await app.vault.getKnowledge("knowledge:crdt");
    expect(note?.markdown).toContain("User edit");
    expect(note?.markdown).toContain("&t=60s");
    expect(note?.markdown).toContain("transcript.md");
    expect(
      (await request(app, "/search?q=Convergent")).headers.get(
        "X-KB-Retrieval-Mode",
      ),
    ).toBe("lexical");
    expect(
      (await (await request(app, "/search?q=Convergent")).json())[0].id,
    ).toBe("knowledge:crdt");
  });
  test("validate entire batch before writes, stale conflicts and serialized concurrent approvals", async () => {
    const app = await setup();
    await ingest(app);
    const p = proposal();
    p.changes.push({
      ...p.changes[0],
      id: "change:two",
      knowledgeId: "knowledge:missing",
      operation: "patch_note",
      before: "stale",
    });
    await app.vault.saveProposal(p);
    const response = await request(
      app,
      "/proposals/proposal:one/review",
      "POST",
      {
        decisions: p.changes.map((c) => ({ changeId: c.id, action: "accept" })),
      },
    );
    expect(response.status).toBe(409);
    expect(await app.vault.listKnowledge()).toHaveLength(0);
    await app.vault.saveProposal(proposal("proposal:race"));
    const decisions = {
      decisions: [{ changeId: "change:one", action: "accept" }],
    };
    const race = await Promise.all([
      request(app, "/proposals/proposal:race/review", "POST", decisions),
      request(app, "/proposals/proposal:race/review", "POST", decisions),
    ]);
    expect(race.map((r) => r.status).sort()).toEqual([200, 409]);
    const existing = (await app.vault.getKnowledge("knowledge:crdt"))!;
    const patch = proposal("proposal:stale");
    patch.changes[0] = {
      ...patch.changes[0],
      operation: "patch_note",
      before: existing.markdown,
      after: "new patch",
    };
    await app.vault.saveProposal(patch);
    await request(app, "/knowledge/knowledge:crdt", "PUT", {
      markdown: "manual external edit",
    });
    expect(
      (
        await request(
          app,
          "/proposals/proposal:stale/review",
          "POST",
          decisions,
        )
      ).status,
    ).toBe(409);
    expect((await app.vault.getKnowledge("knowledge:crdt"))?.markdown).toBe(
      "manual external edit",
    );
  });
  test("granular review can resume pending changes and accept no change", async () => {
    const app = await setup();
    await ingest(app);
    const p = proposal();
    p.changes.push({
      ...p.changes[0],
      id: "change:two",
      knowledgeId: "knowledge:second",
    });
    await app.vault.saveProposal(p);
    expect(
      (
        await request(app, "/proposals/proposal:one/review", "POST", {
          decisions: [{ changeId: "change:one", action: "reject" }],
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await request(app, "/proposals/proposal:one/review", "POST", {
          decisions: [{ changeId: "change:two", action: "accept" }],
        })
      ).status,
    ).toBe(200);
    expect(await app.vault.getKnowledge("knowledge:crdt")).toBeNull();
    expect(await app.vault.getKnowledge("knowledge:second")).not.toBeNull();
    await app.vault.saveProposal({
      ...proposal("proposal:none"),
      outcome: "no_change",
      changes: [],
    });
    expect(
      (
        await request(app, "/proposals/proposal:none/review", "POST", {
          decisions: [],
          acceptNoChange: true,
        })
      ).status,
    ).toBe(200);
  });
  test("edited frontmatter and invalid trailing decisions cannot write; source restart state recovers", async () => {
    const app = await setup();
    await ingest(app);
    await app.vault.saveProposal(proposal());
    const frontmatter = await request(
      app,
      "/proposals/proposal:one/review",
      "POST",
      {
        decisions: [
          {
            changeId: "change:one",
            action: "accept",
            markdown: "---\nid: knowledge:evil\n---\nContent",
          },
        ],
      },
    );
    expect(frontmatter.status).toBe(400);
    expect(await app.vault.listKnowledge()).toHaveLength(0);
    expect(
      (
        await request(app, "/proposals/proposal:one/review", "POST", {
          decisions: [
            { changeId: "change:one", action: "accept" },
            { changeId: "missing", action: "accept" },
          ],
        })
      ).status,
    ).toBe(409);
    expect(await app.vault.listKnowledge()).toHaveLength(0);
    expect(
      (
        await request(app, "/sources", "POST", {
          url: "https://evil.example/file",
        })
      ).status,
    ).toBe(400);
    const source = (await app.vault.getSource(sourceId))!;
    source.status = "synthesis_pending";
    await app.vault.saveSource(source);
    const restart = await createCompanion({ vaultPath: app.vault.root, token });
    apps.push(restart);
    expect((await restart.vault.getSource(sourceId))?.status).toBe("kept");
    await app.vault.saveProposal({
      ...proposal("proposal:reject-none"),
      outcome: "no_change",
      changes: [],
    });
    const rejected = await request(
      app,
      "/proposals/proposal:reject-none/review",
      "POST",
      { decisions: [], rejectNoChange: true },
    );
    expect(rejected.status).toBe(200);
    expect((await rejected.json()).status).toBe("rejected");
  });
  test("restart completes explicitly approved interrupted batch with exact provenance", async () => {
    const app = await setup();
    await ingest(app);
    const p = proposal();
    p.changes.push({
      ...p.changes[0],
      id: "change:two",
      knowledgeId: "knowledge:second",
    });
    await app.vault.saveProposal(p);
    const original = app.vault.applyKnowledgeBatch.bind(app.vault);
    app.vault.applyKnowledgeBatch = async (changes) => {
      await original(changes.slice(0, 1));
      throw new Error("Simulated storage interruption");
    };
    const response = await request(
      app,
      "/proposals/proposal:one/review",
      "POST",
      {
        decisions: p.changes.map((c) => ({ changeId: c.id, action: "accept" })),
      },
    );
    expect(response.status).toBe(500);
    expect(await app.vault.listKnowledge()).toHaveLength(1);
    app.vault.applyKnowledgeBatch = original;
    const restart = await createCompanion({ vaultPath: app.vault.root, token });
    apps.push(restart);
    expect(await restart.vault.listKnowledge()).toHaveLength(2);
    expect(
      (await restart.vault.getKnowledge("knowledge:second"))?.markdown,
    ).toContain("&t=60s");
    expect((await restart.vault.getProposal(p.id))?.status).toBe("accepted");
    expect(await restart.state.readDocument("review")).toBeNull();
    expect(
      (await restart.vault.listTimeline()).filter(
        (e) => e.type === "integrated",
      ),
    ).toHaveLength(1);
  });
  test("accepted patches follow renamed nested notes and preserve long fractional timestamps", async () => {
    const app = await setup();
    await ingest(app);
    const initial = {
      id: "knowledge:nested",
      title: "Nested note",
      markdown: "Old text",
      path: "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      tags: [],
    };
    const path = await app.vault.saveKnowledge(initial);
    await mkdir(join(app.vault.root, "knowledge/topics"));
    await rename(
      join(app.vault.root, path),
      join(app.vault.root, "knowledge/topics/nested.md"),
    );
    const note = (await app.vault.getKnowledge(initial.id))!;
    const p = proposal("proposal:nested", initial.id);
    p.changes[0] = {
      ...p.changes[0],
      operation: "patch_note",
      before: note.markdown,
      evidence: [{ sourceId, start: 90000.125, end: 90001.5 }],
    };
    await app.vault.saveProposal(p);
    expect(
      (
        await request(app, `/proposals/${p.id}/review`, "POST", {
          decisions: [{ changeId: "change:one", action: "accept" }],
        })
      ).status,
    ).toBe(200);
    const changed = (await app.vault.getKnowledge(initial.id))!;
    expect(changed.path).toBe("knowledge/topics/nested.md");
    expect(changed.markdown).toContain(
      "../../sources/youtube/dQw4w9WgXcQ/source.md",
    );
    expect(changed.markdown).toContain("#25:00:00.125");
  });
  test("Git commits only accepted files and preserves unrelated staged changes", async () => {
    const app = await setup();
    const root = app.vault.root;
    async function git(args: string[]) {
      const proc = Bun.spawn(["git", "-C", root, ...args], {
        stdout: "pipe",
        stderr: "pipe",
      });
      const out = await new Response(proc.stdout).text();
      const err = await new Response(proc.stderr).text();
      expect(await proc.exited, err).toBe(0);
      return out.trim();
    }
    await git(["init"]);
    await git(["config", "user.name", "Test"]);
    await git(["config", "user.email", "test@example.com"]);
    await writeFile(join(root, "unrelated.txt"), "initial");
    await git(["add", "unrelated.txt"]);
    await git(["commit", "-m", "initial"]);
    await writeFile(join(root, "unrelated.txt"), "staged user edit");
    await git(["add", "unrelated.txt"]);
    await ingest(app);
    await app.vault.saveProposal(proposal());
    await request(app, "/settings", "PUT", { gitAutoCommit: true });
    const accepted = await request(
      app,
      "/proposals/proposal:one/review",
      "POST",
      { decisions: [{ changeId: "change:one", action: "accept" }] },
    );
    expect(accepted.status).toBe(200);
    const files = await git(["show", "--pretty=", "--name-only", "HEAD"]);
    expect(files).toContain("knowledge/");
    expect(files).not.toContain("unrelated.txt");
    expect(await git(["diff", "--cached", "--name-only"])).toBe(
      "unrelated.txt",
    );
    expect(await git(["show", "HEAD:unrelated.txt"])).toBe("initial");
  });
});

test("failed synthesis exposes a categorized error and an authenticated retained trace", async () => {
  const app = await setup(async (_context, _tools, _config, options) => {
    await options?.trace?.("llm_http_error", {
      status: 401,
      body: "Rejected secret-model-value",
      authorization: "Bearer hidden",
    });
    throw new SynthesisError(
      "PROVIDER_ERROR",
      "The model provider failed (HTTP 401). See the trace.",
    );
  });
  await ingest(app);
  await request(app, `/sources/${sourceId}/reflection`, "PUT", {
    decision: "keep",
    why: "Useful",
    reaction: "",
    questions: "",
    selectedPassages: [],
  });
  await request(app, "/settings", "PUT", {
    inference: { model: "fixture", apiKey: "secret-model-value" },
  });
  const response = await request(
    app,
    `/sources/${sourceId}/synthesize`,
    "POST",
    {},
  );
  expect(response.status).toBe(500);
  expect((await response.json()).error).toContain("PROVIDER_ERROR");
  const job = app.state.jobs
    .slice()
    .reverse()
    .find((job) => job.type === "run_synthesis")!;
  expect(job.state).toBe("failed");
  expect(job.traceId).toBeTruthy();
  const traceResponse = await request(app, `/jobs/${job.id}/trace`);
  expect(traceResponse.status).toBe(200);
  const trace = await traceResponse.json();
  expect(
    trace.events.some(
      (event: { type: string }) => event.type === "llm_http_error",
    ),
  ).toBe(true);
  expect(JSON.stringify(trace)).not.toContain("secret-model-value");
  expect(JSON.stringify(trace)).not.toContain("Bearer hidden");
  expect(
    (
      await request(app, `/jobs/${job.id}/trace`, "GET", undefined, {
        Authorization: "Bearer wrong",
      })
    ).status,
  ).toBe(401);
  expect((await app.vault.getSource(sourceId))?.status).toBe("kept");
});

test("failed caption retry keeps the saved transcript and preserves the actionable failure", async () => {
  const app = await setup();
  await ingest(app);
  await request(app, `/sources/${sourceId}/transcript`, "PUT", {
    text: "00:00 Saved evidence\n00:05 More evidence",
  });
  await request(app, `/sources/${sourceId}/transcript/retry`, "POST", {});
  expect((await app.vault.getTranscript(sourceId))?.segments[0]?.text).toBe(
    "Saved evidence",
  );
  expect((await app.vault.getSource(sourceId))?.transcriptStatus).toBe(
    "available",
  );
  expect(
    app.state.jobs
      .slice()
      .reverse()
      .find((job) => job.type === "transcript_fetch")?.error,
  ).toBe("Paste transcript");
});
