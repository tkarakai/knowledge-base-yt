import { Vault, timestamp } from "@repo/kb";
import {
  normalizeYouTubeUrl,
  fetchYouTubeMetadata,
  parseUserTranscript,
  YouTubeCaptionProvider,
} from "@repo/ingestion";
import { SearchIndex, type SearchDocument } from "@repo/search";
import type {
  AgentContext,
  AgentRunResult,
  AgentTools,
  ModelConfig,
  Source,
  SourceDetail,
  Reflection,
  Transcript,
  KnowledgeNote,
  SynthesisProposal,
  Job,
  TimelineEvent,
} from "@repo/kb-shared";
import { timingSafeEqual } from "node:crypto";
import { posix } from "node:path";
import { ApiError, State, object, string, id } from "./state";
import { commitAccepted } from "./git";
export { commitAccepted } from "./git";
export interface CompanionOptions {
  vaultPath: string;
  token: string;
  allowedOrigins?: string[];
  port?: number;
  synthesize?: (
    context: AgentContext,
    tools: AgentTools,
    config: ModelConfig,
  ) => Promise<AgentRunResult>;
  transcriptProvider?: {
    fetch(videoId: string, language?: string): Promise<Transcript>;
  };
  metadata?: typeof fetchYouTubeMetadata;
}
const MAX_BODY = 2 * 1024 * 1024;
const now = () => new Date().toISOString();
const key = (prefix: string) => `${prefix}:${crypto.randomUUID()}`;
function secureEqual(a: string, b: string) {
  const aa = Buffer.from(a),
    bb = Buffer.from(b);
  return aa.length === bb.length && timingSafeEqual(aa, bb);
}
async function body(request: Request) {
  if (Number(request.headers.get("content-length")) > MAX_BODY)
    throw new ApiError(413, "Request body exceeds 2 MiB");
  if (
    !request.headers
      .get("content-type")
      ?.toLowerCase()
      .startsWith("application/json")
  )
    throw new ApiError(415, "Expected application/json");
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError(400, "Missing request body");
  let size = 0;
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > MAX_BODY) {
      await reader.cancel();
      throw new ApiError(413, "Request body exceeds 2 MiB");
    }
    chunks.push(value);
  }
  try {
    return object(JSON.parse(Buffer.concat(chunks).toString("utf8")));
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw new ApiError(400, "Invalid JSON");
  }
}
export async function scanForSearch(vault: Vault): Promise<SearchDocument[]> {
  const entries = await vault.scan();
  return entries.flatMap((entry) =>
    entry.type === "transcript" && entry.segments?.length
      ? entry.segments.map((segment) => ({
          id: entry.id,
          title: entry.title,
          text: segment.text,
          path: entry.path,
          type: entry.type,
          sourceId: entry.sourceId,
          start: segment.start,
          end: segment.end,
        }))
      : [
          {
            id: entry.id,
            title: entry.title,
            text: entry.markdown,
            path: entry.path,
            type: entry.type,
            sourceId: entry.sourceId,
          },
        ],
  );
}
export async function createCompanion(options: CompanionOptions) {
  if (!options.token || options.token.length < 24)
    throw new Error("KB_COMPANION_TOKEN must contain at least 24 characters");
  const vault = new Vault(options.vaultPath);
  await vault.init();
  const state = new State(vault.root);
  await state.load();
  for (const interrupted of await vault.listSources())
    if (interrupted.status === "synthesis_pending") {
      interrupted.status = "kept";
      await vault.saveSource(interrupted);
    }
  const index = new SearchIndex(await state.path("search.sqlite"), {
    enabled: state.settings.network.embeddings,
    config: state.settings.embeddings,
  });
  const origins = new Set(
    options.allowedOrigins ?? [
      "http://localhost:3000",
      "http://127.0.0.1:3000",
    ],
  );
  let port = options.port ?? 4317,
    queue: Promise<unknown> = Promise.resolve();
  function exclusive<T>(fn: () => Promise<T>): Promise<T> {
    const next = queue.then(fn, fn);
    queue = next.catch(() => {});
    return next;
  }
  async function rebuild() {
    return index.rebuild(await scanForSearch(vault));
  }
  interface ReviewJournal {
    proposal: SynthesisProposal;
    writes: { note: KnowledgeNote; expectedBefore: string | null }[];
    event: TimelineEvent;
  }
  async function finishReview(journal: ReviewJournal) {
    const remaining: ReviewJournal["writes"] = [];
    for (const write of journal.writes) {
      const existing = await vault.getKnowledge(write.note.id);
      if (existing?.markdown === write.note.markdown) continue;
      if (
        write.expectedBefore === null
          ? !!existing
          : existing?.markdown !== write.expectedBefore
      )
        throw new ApiError(
          409,
          "Interrupted review conflicts with a manual edit; restore or resolve .kb/review.json before retrying",
        );
      remaining.push(write);
    }
    await vault.applyKnowledgeBatch(remaining);
    await vault.saveProposal(journal.proposal);
    const s = await source(journal.proposal.sourceId);
    s.status = "integrated";
    await vault.saveSource(s);
    await vault.appendTimeline(journal.event);
    await state.removeDocument("review");
    return Promise.all(
      journal.writes.map(
        async (write) => (await vault.getKnowledge(write.note.id))!.path,
      ),
    );
  }
  const interruptedReview = (await state.readDocument(
    "review",
  )) as ReviewJournal | null;
  try {
    if (interruptedReview) await finishReview(interruptedReview);
    await rebuild();
  } catch (error) {
    index.close();
    throw error;
  }
  async function runJob<T>(
    type: string,
    sourceId: string | undefined,
    fn: () => Promise<T>,
  ): Promise<T> {
    const job: Job = {
      id: key("job"),
      type,
      sourceId,
      state: "running",
      createdAt: now(),
      updatedAt: now(),
    };
    state.jobs.push(job);
    await state.saveJobs();
    try {
      const result = await fn();
      job.state = "completed";
      job.updatedAt = now();
      await state.saveJobs();
      return result;
    } catch (error) {
      job.state = "failed";
      job.error =
        error instanceof ApiError
          ? error.message
          : "Operation failed; review configuration and retry";
      job.updatedAt = now();
      await state.saveJobs();
      throw error;
    }
  }
  async function source(idValue: string) {
    const s = await vault.getSource(id(idValue));
    if (!s) throw new ApiError(404, "Source not found");
    return s;
  }
  async function detail(s: Source): Promise<SourceDetail> {
    return {
      source: s,
      transcript: await vault.getTranscript(s.id),
      reflection: await vault.getReflection(s.id),
      proposals: (await vault.listProposals()).filter(
        (p) => p.sourceId === s.id,
      ),
      related: await index.search(s.title, 8),
    };
  }
  async function timeline(
    s: Source,
    type:
      | "encountered"
      | "kept"
      | "ignored"
      | "deferred"
      | "synthesized"
      | "integrated",
  ) {
    await vault.appendTimeline({
      id: key("event"),
      at: now(),
      sourceId: s.id,
      title: s.title,
      type,
    });
  }
  async function acquireTranscript(s: Source) {
    const provider =
      options.transcriptProvider ??
      new YouTubeCaptionProvider({
        networkEnabled: state.settings.network.youtube,
      });
    const t = await runJob("transcript_fetch", s.id, () =>
      provider.fetch(s.videoId),
    );
    if (t.sourceId !== s.id)
      throw new ApiError(400, "Transcript source mismatch");
    await vault.saveTranscript(t);
    if (!["available", "partial"].includes(t.status)) {
      const job = state.jobs
        .slice()
        .reverse()
        .find(
          (job) => job.type === "transcript_fetch" && job.sourceId === s.id,
        )!;
      job.state = t.status === "failed" ? "failed" : "waiting_for_user";
      job.error = "Transcript unavailable; retry or import timestamped text";
      await state.saveJobs();
    }
    s.transcriptStatus = t.status;
    await vault.saveSource(s);
    return t;
  }
  function provenance(
    markdown: string,
    change: SynthesisProposal["changes"][number],
    s: Source,
    notePath: string,
  ) {
    const sourcePath = posix.relative(
      posix.dirname(notePath),
      `sources/youtube/${s.videoId}/source.md`,
    );
    const transcriptPath = posix.relative(
      posix.dirname(notePath),
      `sources/youtube/${s.videoId}/transcript.md`,
    );
    if (/^\s*---(?:\r?\n|$)/.test(markdown))
      throw new ApiError(
        400,
        "Knowledge edits must be Markdown body without YAML frontmatter",
      );
    const lines = change.evidence.map((e) => {
      if (
        e.sourceId !== s.id ||
        (e.start !== undefined && (!Number.isFinite(e.start) || e.start < 0)) ||
        (e.end !== undefined &&
          (!Number.isFinite(e.end) || e.end < (e.start ?? 0)))
      )
        throw new ApiError(400, "Invalid proposal evidence");
      const stamp =
        e.start === undefined
          ? ""
          : ` at ${e.start}s${e.end === undefined ? "" : `–${e.end}s`}`;
      return `- [${s.id}${stamp}](${s.url}${e.start === undefined ? "" : `&t=${Math.floor(e.start)}s`}) · [source](${sourcePath}) · [transcript](${transcriptPath}${e.start === undefined ? "" : `#${timestamp(e.start)}`})`;
    });
    if (!lines.length)
      throw new ApiError(400, "Accepted changes require source evidence");
    return `${markdown.trimEnd()}\n\n## Provenance\n\n${[...new Set(lines)].join("\n")}\n`;
  }
  async function review(proposalId: string, data: Record<string, unknown>) {
    const p = await vault.getProposal(id(proposalId));
    if (!p) throw new ApiError(404, "Proposal not found");
    if (!Array.isArray(data.decisions))
      throw new ApiError(400, "Expected review decisions");
    if (
      !p.changes.some((c) => c.decision === "pending") &&
      p.status !== "pending"
    )
      throw new ApiError(409, "Proposal already reviewed");
    const s = await source(p.sourceId);
    if (p.outcome === "no_change") {
      if (
        data.decisions.length ||
        (data.acceptNoChange === true) === (data.rejectNoChange === true)
      )
        throw new ApiError(400, "Explicit no-change decision required");
      p.status = data.acceptNoChange === true ? "accepted" : "rejected";
      await vault.saveProposal(p);
      if (p.status === "accepted") {
        s.status = "integrated";
        await vault.saveSource(s);
        await timeline(s, "integrated");
      }
      return p;
    }
    if (!data.decisions.length)
      throw new ApiError(400, "Select at least one change");
    const seen = new Set<string>(),
      targets = new Set<string>();
    const writes: { note: KnowledgeNote; expectedBefore: string | null }[] = [];
    for (const raw of data.decisions) {
      const d = object(raw),
        changeId = string(d.changeId, "change ID"),
        change = p.changes.find((c) => c.id === changeId);
      if (seen.has(changeId) || !change || change.decision !== "pending")
        throw new ApiError(409, "Change missing or already reviewed");
      seen.add(changeId);
      if (d.action !== "accept" && d.action !== "reject")
        throw new ApiError(400, "Invalid review action");
      if (d.action === "reject") {
        change.decision = "rejected";
        continue;
      }
      id(change.knowledgeId);
      if (targets.has(change.knowledgeId))
        throw new ApiError(400, "Multiple accepted changes target one note");
      targets.add(change.knowledgeId);
      const existing = await vault.getKnowledge(change.knowledgeId);
      if (
        change.operation === "create_note"
          ? !!existing || change.before !== ""
          : change.operation !== "patch_note" ||
            !existing ||
            existing.markdown !== change.before
      )
        throw new ApiError(
          409,
          "Knowledge changed since proposal; generate a fresh proposal",
        );
      const markdown = provenance(
        string(
          d.markdown === undefined ? change.after : d.markdown,
          "markdown",
        ),
        change,
        s,
        existing?.path || "knowledge/new.md",
      );
      const note: KnowledgeNote = {
        id: change.knowledgeId,
        title: string(change.title, "title"),
        markdown,
        path: existing?.path ?? "",
        createdAt: existing?.createdAt ?? now(),
        updatedAt: now(),
        tags: existing?.tags ?? [],
      };
      writes.push({ note, expectedBefore: existing?.markdown ?? null });
      change.after = markdown;
      change.decision = "accepted";
    }
    return runJob("apply_proposal", s.id, async () => {
      p.status = p.changes.every((c) => c.decision === "accepted")
        ? "accepted"
        : p.changes.every((c) => c.decision === "rejected")
          ? "rejected"
          : "partially_accepted";
      if (!writes.length) {
        await vault.saveProposal(p);
        return p;
      }
      const journal: ReviewJournal = {
        proposal: p,
        writes,
        event: {
          id: key("event"),
          at: now(),
          sourceId: s.id,
          title: s.title,
          type: "integrated",
        },
      };
      // Record explicit user approval before publishing; restart can finish an interrupted batch.
      await state.writeDocument("review", journal);
      let changed: string[];
      try {
        await vault.applyKnowledgeBatch(writes);
        changed = await finishReview(journal);
      } catch (error) {
        // Pre-publication validation failures must never be retried as accepted writes.
        if (
          ["VALIDATION", "PATH_UNSAFE", "CONFLICT", "TOO_LARGE"].includes(
            (error as { code?: string }).code ?? "",
          )
        )
          await state.removeDocument("review");
        throw error;
      }
      await rebuild();
      if (state.settings.gitAutoCommit)
        await commitAccepted(vault.root, changed, s.id);
      return p;
    });
  }
  async function route(request: Request, url: URL) {
    if (request.method !== "GET") {
      const pending = (await state.readDocument(
        "review",
      )) as ReviewJournal | null;
      if (pending) {
        await finishReview(pending);
        await rebuild();
      }
    }
    let parts: string[];
    try {
      parts = url.pathname.split("/").filter(Boolean).map(decodeURIComponent);
    } catch {
      throw new ApiError(400, "Invalid path encoding");
    }
    if (
      parts.some(
        (p) =>
          p.includes("/") ||
          p.includes("\\") ||
          p.includes("..") ||
          p.includes("\0"),
      )
    )
      throw new ApiError(400, "Invalid path");
    const method = request.method,
      [resource, item, action, subaction] = parts;
    if (method === "GET") {
      if (parts.length === 1)
        switch (resource) {
          case "health":
            return {
              ok: true,
              vaultPath: vault.root,
              version: "0.1.0",
              retrieval: index.diagnostics,
            };
          case "sources":
            return vault.listSources();
          case "knowledge":
            return vault.listKnowledge();
          case "proposals":
            return vault.listProposals();
          case "timeline":
            return vault.listTimeline();
          case "jobs":
            return state.jobs;
          case "settings":
            return state.redacted();
          case "search":
            return index.search(
              (url.searchParams.get("q") ?? "").slice(0, 2000),
            );
        }
      if (parts.length === 2 && resource === "documents") {
        id(item);
        const document = (await vault.scan()).find(
          (entry) => entry.type === "document" && entry.id === item,
        );
        if (!document) throw new ApiError(404, "Document not found");
        return {
          id: document.id,
          title: document.title,
          markdown: document.markdown,
          path: document.path,
        };
      }
      if (parts.length === 2 && resource === "sources")
        return detail(await source(item));
      if (parts.length === 2 && resource === "knowledge") {
        const note = await vault.getKnowledge(id(item));
        if (!note) throw new ApiError(404, "Knowledge not found");
        return note;
      }
    }
    if (
      method === "POST" &&
      resource === "index" &&
      item === "rebuild" &&
      parts.length === 2
    )
      return runJob("rebuild_index", undefined, rebuild);
    if (method === "POST" && resource === "sources" && parts.length === 1) {
      const data = await body(request),
        normalized = normalizeYouTubeUrl(string(data.url, "URL"));
      let s = await vault.getSource(normalized.sourceId);
      const at = now();
      if (s) {
        s.lastSeenAt = at;
        s.encounters.push(at);
        await vault.saveSource(s);
        await timeline(s, "encountered");
        return detail(s);
      }
      const metadata = await runJob(
        "source_metadata",
        normalized.sourceId,
        () =>
          (options.metadata ?? fetchYouTubeMetadata)(normalized.videoId, {
            networkEnabled: state.settings.network.youtube,
          }),
      );
      s = {
        id: normalized.sourceId,
        videoId: normalized.videoId,
        url: normalized.url,
        title: metadata.title,
        channel: metadata.channel,
        publishedAt: metadata.publishedAt,
        firstSeenAt: at,
        lastSeenAt: at,
        status: "ready_for_reflection",
        transcriptStatus: "requires_user_action",
        encounters: [at],
        tags: [],
      };
      await vault.saveSource(s);
      await timeline(s, "encountered");
      await acquireTranscript(s);
      await rebuild();
      return detail(s);
    }
    if (resource === "sources" && item) {
      const s = await source(item);
      if (method === "PUT" && action === "reflection" && parts.length === 3) {
        const data = await body(request);
        if (!["keep", "ignore", "later"].includes(String(data.decision)))
          throw new ApiError(400, "Invalid reflection decision");
        if (
          !Array.isArray(data.selectedPassages) ||
          data.selectedPassages.length > 500
        )
          throw new ApiError(400, "Invalid selected passages");
        const passages = data.selectedPassages.map((raw) => {
          const p = object(raw);
          if (
            typeof p.start !== "number" ||
            typeof p.end !== "number" ||
            !Number.isFinite(p.start) ||
            !Number.isFinite(p.end) ||
            p.start < 0 ||
            p.end < p.start
          )
            throw new ApiError(400, "Invalid passage timestamps");
          return {
            start: p.start,
            end: p.end,
            text: string(p.text, "passage text"),
          };
        });
        const existing = await vault.getReflection(s.id);
        const reflection: Reflection = {
          sourceId: s.id,
          decision: data.decision as Reflection["decision"],
          why: string(data.why, "why", true),
          reaction: string(data.reaction, "reaction", true),
          questions: string(data.questions, "questions", true),
          selectedPassages: passages,
          createdAt: existing?.createdAt ?? now(),
          updatedAt: now(),
        };
        await vault.saveReflection(reflection);
        s.status =
          reflection.decision === "keep"
            ? "kept"
            : reflection.decision === "ignore"
              ? "ignored"
              : "deferred";
        await vault.saveSource(s);
        await timeline(s, s.status);
        await rebuild();
        return detail(s);
      }
      if (method === "PUT" && action === "transcript" && parts.length === 3) {
        const data = await body(request);
        const transcript = parseUserTranscript(
          string(data.text, "transcript"),
          s.id,
          data.language === undefined
            ? undefined
            : string(data.language, "language"),
        );
        await runJob("transcript_normalize", s.id, () =>
          vault.saveTranscript(transcript),
        );
        s.transcriptStatus = transcript.status;
        await vault.saveSource(s);
        await rebuild();
        return detail(s);
      }
      if (
        method === "POST" &&
        action === "transcript" &&
        subaction === "retry" &&
        parts.length === 4
      ) {
        await acquireTranscript(s);
        await rebuild();
        return detail(s);
      }
      if (method === "POST" && action === "synthesize" && parts.length === 3) {
        const reflection = await vault.getReflection(s.id);
        if (
          !reflection ||
          reflection.decision !== "keep" ||
          !reflection.why.trim() ||
          ["ignored", "deferred"].includes(s.status)
        )
          throw new ApiError(
            409,
            "Keep this source and explain why before synthesis",
          );
        if (!state.settings.network.inference)
          throw new ApiError(409, "Inference network disabled");
        if (!state.settings.inference.model)
          throw new ApiError(409, "Configure an inference model first");
        return runJob("run_synthesis", s.id, async () => {
          s.status = "synthesis_pending";
          await vault.saveSource(s);
          try {
            const synthesize =
              options.synthesize ?? (await import("@repo/kb-agent")).synthesize;
            const context: AgentContext = {
              source: s,
              reflection,
              transcript: await vault.getTranscript(s.id),
              related: await index.search(`${s.title} ${reflection.why}`, 12),
            };
            const result = await synthesize(
              context,
              {
                search: (q) => index.search(q),
                read: async (value) => vault.getKnowledge(id(value)),
              },
              state.settings.inference,
            );
            if (
              result.proposal.sourceId !== s.id ||
              result.proposal.status !== "pending" ||
              result.proposal.changes.some((c) => c.decision !== "pending")
            )
              throw new ApiError(400, "Invalid synthesis proposal");
            await vault.saveProposal(result.proposal);
            await vault.saveAudit({
              id: key("agent-run"),
              sourceId: s.id,
              proposalId: result.proposal.id,
              ...result.audit,
            });
            s.status = "proposal_ready";
            await vault.saveSource(s);
            await timeline(s, "synthesized");
            return result.proposal;
          } catch (error) {
            s.status = "kept";
            await vault.saveSource(s);
            throw error;
          }
        });
      }
    }
    if (
      method === "POST" &&
      resource === "proposals" &&
      item &&
      action === "review" &&
      parts.length === 3
    )
      return review(item, await body(request));
    if (
      method === "PUT" &&
      resource === "knowledge" &&
      item &&
      parts.length === 2
    ) {
      const existing = await vault.getKnowledge(id(item));
      if (!existing) throw new ApiError(404, "Knowledge not found");
      const data = await body(request);
      const note = {
        ...existing,
        markdown: string(data.markdown, "markdown", true),
        title:
          data.title === undefined
            ? existing.title
            : string(data.title, "title"),
        updatedAt: now(),
      };
      await vault.applyKnowledgeBatch([
        { note, expectedBefore: existing.markdown },
      ]);
      await rebuild();
      return (await vault.getKnowledge(note.id))!;
    }
    if (method === "POST" && resource === "documents" && parts.length === 1) {
      const data = await body(request);
      const document = await vault.importDocument({
        title: string(data.title, "title"),
        markdown: string(data.markdown, "markdown"),
        filename:
          data.filename === undefined
            ? undefined
            : string(data.filename, "filename"),
      });
      await rebuild();
      return { id: document.id };
    }
    if (method === "PUT" && resource === "settings" && parts.length === 1) {
      const result = await state.update(await body(request));
      index.configure({
        enabled: state.settings.network.embeddings,
        config: state.settings.embeddings,
      });
      return result;
    }
    throw new ApiError(404, "Route not found");
  }
  async function fetchHandler(request: Request): Promise<Response> {
    try {
      const url = new URL(request.url),
        host = request.headers.get("host") ?? url.host;
      if (!new Set([`127.0.0.1:${port}`, `localhost:${port}`]).has(host))
        throw new ApiError(403, "Host not allowed");
      const origin = request.headers.get("origin");
      if (origin && !origins.has(origin))
        throw new ApiError(403, "Origin not allowed");
      if (
        !secureEqual(
          request.headers.get("authorization") ?? "",
          `Bearer ${options.token}`,
        )
      )
        throw new ApiError(401, "Unauthorized");
      if (Number(request.headers.get("content-length")) > MAX_BODY)
        throw new ApiError(413, "Request body exceeds 2 MiB");
      const value =
        request.method === "GET"
          ? await route(request, url)
          : await exclusive(() => route(request, url));
      return Response.json(value, {
        headers: {
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
          "X-KB-Retrieval-Mode": index.diagnostics.mode,
          ...(index.diagnostics.reason
            ? { "X-KB-Retrieval-Reason": index.diagnostics.reason }
            : {}),
        },
      });
    } catch (error) {
      const code = (error as { code?: string }).code;
      const status =
        error instanceof ApiError
          ? error.status
          : code === "CONFLICT"
            ? 409
            : code === "TOO_LARGE"
              ? 413
              : ["VALIDATION", "PATH_UNSAFE", "INVALID_INPUT"].includes(
                    code ?? "",
                  )
                ? 400
                : 500;
      return Response.json(
        {
          error:
            error instanceof ApiError
              ? error.message
              : status === 409
                ? "Knowledge changed since proposal; retry"
                : status === 400
                  ? "Invalid input or unsafe path"
                  : status === 413
                    ? "Content exceeds 2 MiB"
                    : "Operation failed; check configuration and retry",
        },
        { status, headers: { "Cache-Control": "no-store" } },
      );
    }
  }
  return {
    vault,
    state,
    index,
    fetch: fetchHandler,
    rebuild,
    start() {
      const server = Bun.serve({
        hostname: "127.0.0.1",
        port,
        development: false,
        fetch: fetchHandler,
        maxRequestBodySize: MAX_BODY,
        idleTimeout: 180,
      });
      port = server.port!;
      return server;
    },
    close() {
      index.close();
    },
  };
}
