import { parseDocument, stringify } from "yaml";

export class VaultError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "VALIDATION"
      | "PATH_UNSAFE"
      | "CONFLICT"
      | "TOO_LARGE" = "VALIDATION",
  ) {
    super(message);
    this.name = "VaultError";
  }
}
export const MAX_FILE_BYTES = 2 * 1024 * 1024;
export const kinds = [
  "source",
  "transcript",
  "reflection",
  "knowledge",
  "document",
  "proposal",
  "timeline",
  "agent-run",
] as const;
export type Kind = (typeof kinds)[number];
export type RecordData = Record<string, any>;
export function fail(message: string): never {
  throw new VaultError(message);
}
export function object(
  value: unknown,
  name: string,
): asserts value is RecordData {
  if (!value || typeof value !== "object" || Array.isArray(value))
    fail(`${name} must be an object`);
}
export function string(
  value: unknown,
  name: string,
  nonempty = false,
): asserts value is string {
  if (
    typeof value !== "string" ||
    value.includes("\0") ||
    (nonempty && !value.trim())
  )
    fail(`${name} must be ${nonempty ? "nonempty " : ""}text`);
}
export function safeId(value: unknown): asserts value is string {
  if (
    typeof value !== "string" ||
    !/^[A-Za-z0-9_-]+(?::[A-Za-z0-9_-]+)*$/.test(value) ||
    value.length > 180
  )
    throw new VaultError("Invalid record ID", "PATH_UNSAFE");
}
function date(value: unknown, name: string) {
  string(value, name, true);
  if (
    !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/.test(
      value,
    ) ||
    !Number.isFinite(Date.parse(value))
  )
    fail(`${name} must be an ISO timestamp`);
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  const d = new Date(Date.UTC(year!, month! - 1, day!));
  if (d.getUTCMonth() !== month! - 1 || d.getUTCDate() !== day!)
    fail(`${name} is not a calendar date`);
}
function oneOf(value: unknown, values: string[], name: string) {
  if (!values.includes(value as string)) fail(`Invalid ${name}`);
}
function array(value: unknown, name: string): asserts value is any[] {
  if (!Array.isArray(value)) fail(`${name} must be an array`);
}
function strings(value: unknown, name: string) {
  array(value, name);
  value.forEach((v) => string(v, name));
}
function sourceId(value: unknown) {
  safeId(value);
  if (!/^youtube:[A-Za-z0-9_-]{11}$/.test(value as string))
    fail("Invalid YouTube source ID");
}
function range(value: RecordData) {
  if (
    typeof value.start !== "number" ||
    !Number.isFinite(value.start) ||
    value.start < 0 ||
    typeof value.end !== "number" ||
    !Number.isFinite(value.end) ||
    value.end < value.start
  )
    fail("Invalid timestamp range");
  for (const time of [value.start, value.end])
    if (
      !Number.isSafeInteger(Math.round(time * 1000)) ||
      Math.abs(time * 1000 - Math.round(time * 1000)) > 1e-6
    )
      fail("Timestamp precision must be milliseconds");
}
export function validate(kind: Kind, v: RecordData) {
  object(v, kind);
  if (kind === "transcript" || kind === "reflection") sourceId(v.sourceId);
  else safeId(v.id);
  if (kind === "source") {
    sourceId(v.id);
    string(v.videoId, "videoId");
    if (
      v.id !== `youtube:${v.videoId}` ||
      v.url !== `https://www.youtube.com/watch?v=${v.videoId}`
    )
      fail("Source identity and canonical URL must agree");
    string(v.title, "title", true);
    string(v.channel, "channel");
    date(v.firstSeenAt, "firstSeenAt");
    date(v.lastSeenAt, "lastSeenAt");
    if (Date.parse(v.lastSeenAt) < Date.parse(v.firstSeenAt))
      fail("Encounter dates are reversed");
    if (v.publishedAt !== undefined) date(v.publishedAt, "publishedAt");
    array(v.encounters, "encounters");
    v.encounters.forEach((d: unknown) => date(d, "encounter"));
    strings(v.tags, "tags");
    oneOf(
      v.status,
      [
        "ready_for_reflection",
        "kept",
        "ignored",
        "deferred",
        "synthesis_pending",
        "proposal_ready",
        "integrated",
      ],
      "source status",
    );
    oneOf(
      v.transcriptStatus,
      ["available", "partial", "unavailable", "failed", "requires_user_action"],
      "transcript status",
    );
  } else if (kind === "transcript") {
    string(v.language, "language", true);
    string(v.provider, "provider", true);
    if (v.generated !== null && typeof v.generated !== "boolean")
      fail("generated must be boolean or null");
    oneOf(
      v.status,
      ["available", "partial", "unavailable", "failed", "requires_user_action"],
      "transcript status",
    );
    if (v.error !== undefined) string(v.error, "error");
    array(v.segments, "segments");
    let previous = -1;
    v.segments.forEach((s: RecordData) => {
      object(s, "segment");
      range(s);
      string(s.text, "segment text", true);
      if (s.start < previous) fail("Transcript timestamps must be ordered");
      previous = s.start;
    });
    if (["available", "partial"].includes(v.status) !== v.segments.length > 0)
      fail("Transcript status must match its segments");
  } else if (kind === "reflection") {
    oneOf(v.decision, ["keep", "ignore", "later"], "reflection decision");
    ["why", "reaction", "questions"].forEach((k) => string(v[k], k));
    array(v.selectedPassages, "selectedPassages");
    v.selectedPassages.forEach((p: RecordData) => {
      object(p, "passage");
      range(p);
      string(p.text, "passage", true);
    });
    date(v.createdAt, "createdAt");
    date(v.updatedAt, "updatedAt");
  } else if (kind === "knowledge" || kind === "document") {
    if (!v.id.startsWith(`${kind}:`)) fail(`Expected ${kind}: ID`);
    string(v.title, "title", true);
    string(v.markdown, "markdown");
    if (kind === "knowledge") {
      if (v.path !== undefined) string(v.path, "path");
      date(v.createdAt, "createdAt");
      date(v.updatedAt, "updatedAt");
      strings(v.tags, "tags");
    } else {
      date(v.importedAt, "importedAt");
      string(v.originalFilename, "originalFilename");
      string(v.contentHash, "contentHash", true);
    }
  } else if (kind === "proposal") {
    sourceId(v.sourceId);
    date(v.createdAt, "createdAt");
    ["model", "summary", "whyItMatters"].forEach((k) => string(v[k], k));
    oneOf(v.outcome, ["changes", "no_change"], "proposal outcome");
    oneOf(
      v.status,
      ["pending", "accepted", "partially_accepted", "rejected"],
      "proposal status",
    );
    strings(v.questions, "questions");
    array(v.changes, "changes");
    if ((v.outcome === "changes") !== v.changes.length > 0)
      fail("Proposal outcome must match changes");
    const ids = new Set();
    v.changes.forEach((c: RecordData) => {
      object(c, "change");
      safeId(c.id);
      safeId(c.knowledgeId);
      if (!c.knowledgeId.startsWith("knowledge:")) fail("Invalid knowledge ID");
      if (ids.has(c.id)) fail("Duplicate change ID");
      ids.add(c.id);
      oneOf(c.operation, ["create_note", "patch_note"], "operation");
      oneOf(c.decision, ["pending", "accepted", "rejected"], "decision");
      ["title", "before", "after", "rationale"].forEach((k) => string(c[k], k));
      if (c.operation === "create_note" && c.before !== "")
        fail("Create note must have empty before text");
      array(c.evidence, "evidence");
      c.evidence.forEach((e: RecordData) => {
        object(e, "evidence");
        safeId(e.sourceId);
        if (
          e.start !== undefined &&
          (typeof e.start !== "number" ||
            !Number.isFinite(e.start) ||
            e.start < 0)
        )
          fail("Invalid evidence start");
        if (e.end !== undefined) {
          if (e.start === undefined) fail("Evidence end requires start");
          range(e);
        }
        if (e.quote !== undefined) string(e.quote, "quote");
      });
    });
  } else if (kind === "timeline") {
    sourceId(v.sourceId);
    date(v.at, "at");
    string(v.title, "title");
    oneOf(
      v.type,
      [
        "encountered",
        "kept",
        "ignored",
        "deferred",
        "synthesized",
        "integrated",
      ],
      "timeline type",
    );
  } else {
    sourceId(v.sourceId);
    date(v.startedAt, "startedAt");
    date(v.completedAt, "completedAt");
    string(v.model, "model", true);
    string(v.promptVersion, "promptVersion", true);
    if (v.proposalId !== undefined) safeId(v.proposalId);
    array(v.toolCalls, "toolCalls");
    v.toolCalls.forEach((t: RecordData) => {
      object(t, "tool call");
      string(t.name, "tool name");
      string(t.summary, "tool summary");
    });
    if (v.usage !== undefined) {
      object(v.usage, "usage");
      for (const k of ["input", "output"])
        if (!Number.isSafeInteger(v.usage[k]) || v.usage[k] < 0)
          fail("Invalid token usage");
    }
  }
}
function transform(value: any, keyFn: (key: string) => string): any {
  if (Array.isArray(value)) return value.map((v) => transform(v, keyFn));
  if (value && typeof value === "object") {
    const result = Object.create(null);
    for (const k of Object.keys(value).sort()) {
      if (["__proto__", "prototype", "constructor"].includes(k))
        fail("Unsafe metadata key");
      if (value[k] !== undefined) result[keyFn(k)] = transform(value[k], keyFn);
    }
    return result;
  }
  return value;
}
const snake = (s: string) => s.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
const camel = (s: string) =>
  s.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
export function timestamp(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor(seconds / 60) % 60;
  const secs = seconds % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${secs.toFixed(3).padStart(6, "0")}`;
}
function parseTime(s: string): number {
  const [h, m, sec] = s.split(":").map(Number);
  if (m! > 59 || sec! >= 60) fail("Invalid transcript timestamp");
  return h! * 3600 + m! * 60 + sec!;
}
export function transcriptBody(segments: RecordData[]): string {
  return segments
    .map(
      (s) =>
        `## ${timestamp(s.start)} --> ${timestamp(s.end)}\n\n${s.text.replace(/^(\\*## )/gm, "\\$1")}\n`,
    )
    .join("\n");
}
function parseSegments(body: string): RecordData[] {
  if (!body.trim()) return [];
  const pattern =
    /^## (\d{2,}:\d{2}:\d{2}\.\d{3}) --> (\d{2,}:\d{2}:\d{2}\.\d{3})\n/gm;
  const matches = [...body.matchAll(pattern)];
  if (!matches.length || body.slice(0, matches[0]!.index).trim())
    fail("Transcript body must use timestamp headings");
  return matches.map((m, i) => ({
    start: parseTime(m[1]!),
    end: parseTime(m[2]!),
    text: body
      .slice(m.index! + m[0].length, matches[i + 1]?.index ?? body.length)
      .trim()
      .replace(/^\\(\\*## )/gm, "$1"),
  }));
}
export interface ParsedRecord {
  kind: Kind;
  data: RecordData;
  extra: RecordData;
  body: string;
}
export function parseMarkdown(raw: string): ParsedRecord | null {
  if (Buffer.byteLength(raw) > MAX_FILE_BYTES)
    throw new VaultError("Markdown exceeds size limit", "TOO_LARGE");
  const normalized = raw.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
  if (!normalized.startsWith("---\n")) return null;
  const end = normalized.indexOf("\n---\n", 4);
  if (end < 0) fail("Unclosed YAML frontmatter");
  let meta: RecordData;
  try {
    const doc = parseDocument(normalized.slice(4, end), {
      uniqueKeys: true,
      customTags: [],
    });
    if (doc.errors.length || doc.warnings.length)
      fail("Invalid YAML frontmatter");
    meta = doc.toJS({ maxAliasCount: 0 });
    object(meta, "frontmatter");
  } catch {
    return fail("Invalid YAML frontmatter");
  }
  if (typeof meta.schema !== "string" || !meta.schema.startsWith("kb/"))
    return null;
  const kind = kinds.find((k) => meta.schema === `kb/${k}/v1`);
  if (!kind) fail("Unsupported vault schema");
  // One separator blank line is formatting; preserve the remaining Markdown exactly.
  let body = normalized.slice(end + 5);
  if (body.startsWith("\n")) body = body.slice(1);
  const data = transform(meta, camel);
  delete data.schema;
  if (kind === "knowledge" || kind === "document") data.markdown = body;
  if (kind === "transcript") data.segments = parseSegments(body);
  validate(kind, data);
  return { kind, data, extra: meta, body };
}
export function serializeMarkdown(
  kind: Kind,
  data: RecordData,
  extra: RecordData = {},
): string {
  validate(kind, data);
  const fields = { ...data };
  delete fields.path;
  delete fields.markdown;
  let body: string;
  if (kind === "knowledge" || kind === "document") body = data.markdown;
  else if (kind === "transcript") {
    delete fields.segments;
    body = transcriptBody(data.segments);
  } else if (kind === "source")
    body = `# ${data.title}\n\n[YouTube source](${data.url})\n`;
  else if (kind === "reflection")
    body = `# Reflection\n\n## Why\n\n${data.why}\n\n## Reaction\n\n${data.reaction}\n\n## Questions\n\n${data.questions}\n`;
  else if (kind === "proposal")
    body = `# Synthesis proposal\n\n${data.summary}\n\n${data.whyItMatters}\n`;
  else if (kind === "timeline")
    body = `# ${data.title}\n\n${data.at} — ${data.type}\n`;
  else
    body = `# Agent run\n\nModel: ${data.model}\n\nApplication tool summaries are recorded in frontmatter.\n`;
  // Preserve extension metadata, but remove absent optional schema fields on updates
  // (for example a successful retry must clear the previous transcript error).
  const extensions = { ...extra };
  const known = [
    "schema",
    "id",
    "source_id",
    "video_id",
    "url",
    "title",
    "channel",
    "published_at",
    "first_seen_at",
    "last_seen_at",
    "status",
    "transcript_status",
    "encounters",
    "tags",
    "language",
    "provider",
    "generated",
    "error",
    "segments",
    "decision",
    "why",
    "reaction",
    "questions",
    "selected_passages",
    "created_at",
    "updated_at",
    "markdown",
    "path",
    "imported_at",
    "original_filename",
    "content_hash",
    "model",
    "summary",
    "why_it_matters",
    "outcome",
    "changes",
    "at",
    "type",
    "proposal_id",
    "started_at",
    "completed_at",
    "prompt_version",
    "tool_calls",
    "usage",
  ];
  for (const key of known) delete extensions[key];
  const metadata = transform(
    { ...extensions, ...transform(fields, snake), schema: `kb/${kind}/v1` },
    (s) => s,
  );
  delete metadata.path;
  delete metadata.markdown;
  if (kind === "transcript") delete metadata.segments;
  const result = `---\n${stringify(metadata, { sortMapEntries: true, lineWidth: 0, aliasDuplicateObjects: false })}---\n\n${body}`;
  if (Buffer.byteLength(result) > MAX_FILE_BYTES)
    throw new VaultError("Markdown exceeds size limit", "TOO_LARGE");
  return result;
}
