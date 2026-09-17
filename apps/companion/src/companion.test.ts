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
async function setup() {
  const root = await mkdtemp(join(await realpath(tmpdir()), "companion-test-"));
  roots.push(root);
  const app = await createCompanion({
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
