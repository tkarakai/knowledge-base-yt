export type SourceStatus =
  | "ready_for_reflection"
  | "kept"
  | "ignored"
  | "deferred"
  | "synthesis_pending"
  | "proposal_ready"
  | "integrated";
export type TranscriptStatus =
  | "available"
  | "partial"
  | "unavailable"
  | "failed"
  | "requires_user_action";
export interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
}
export interface Transcript {
  sourceId: string;
  language: string;
  provider: string;
  generated: boolean | null;
  status: TranscriptStatus;
  segments: TranscriptSegment[];
  error?: string;
}
export interface Source {
  id: string;
  videoId: string;
  url: string;
  title: string;
  channel: string;
  channelUrl?: string;
  thumbnailUrl?: string;
  channelAvatarUrl?: string;
  thumbnailPath?: string;
  channelAvatarPath?: string;
  publishedAt?: string;
  publishedOn?: string;
  metadataCheckedAt?: string;
  metadataError?: string;
  firstSeenAt: string;
  lastSeenAt: string;
  status: SourceStatus;
  transcriptStatus: TranscriptStatus;
  encounters: string[];
  tags: string[];
  /** Calendar date shown by YouTube; never an invented watch timestamp. */
  history?: { provider: "youtube-history"; watchedOn: string };
}

export interface HistoryEntry {
  videoId: string;
  title: string;
  channel: string;
  watchedOn: string;
  channelUrl?: string;
  thumbnailUrl?: string;
  channelAvatarUrl?: string;
}

export type VideoImageKind = "thumbnail" | "avatar";
/** Narrow remote URL validation shared by collection, persistence, and fetching. */
export function youtubeImageUrl(
  value: unknown,
  kind: VideoImageKind,
): string | undefined {
  if (typeof value !== "string" || value.length > 4096 || /[\s\\]/.test(value))
    return undefined;
  try {
    const url = new URL(value);
    const hosts =
      kind === "thumbnail"
        ? [
            "i.ytimg.com",
            "i1.ytimg.com",
            "i2.ytimg.com",
            "i3.ytimg.com",
            "i4.ytimg.com",
            "img.youtube.com",
          ]
        : ["yt3.ggpht.com", "yt3.googleusercontent.com"];
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.port ||
      !hosts.includes(url.hostname)
    )
      return undefined;
    url.hash = "";
    return url.href;
  } catch {
    return undefined;
  }
}
export function youtubeChannelUrl(value: unknown): string | undefined {
  if (typeof value !== "string" || value.length > 2048 || /[\s\\]/.test(value))
    return undefined;
  try {
    const url = new URL(value, "https://www.youtube.com");
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.port ||
      !["www.youtube.com", "youtube.com"].includes(url.hostname) ||
      !/^\/(?:@[^/]+|channel\/[A-Za-z0-9_-]+|(?:c|user)\/[^/]+)\/?$/.test(
        url.pathname,
      )
    )
      return undefined;
    return `https://www.youtube.com${url.pathname.replace(/\/$/, "")}`;
  } catch {
    return undefined;
  }
}
export interface HistoryBatch {
  runId: string;
  batchId: string;
  cutoff: string;
  through: string;
  entries: HistoryEntry[];
}
export interface HistoryBatchResult {
  added: number;
  known: number;
  outsideWindow: number;
}
export interface HistoryConnection {
  connected: boolean;
  connectedAt?: string;
  lastImportAt?: string;
  lastBatch?: HistoryBatchResult;
}
export interface SelectedPassage {
  start: number;
  end: number;
  text: string;
}
export interface Reflection {
  sourceId: string;
  decision: "keep" | "ignore" | "later";
  why: string;
  reaction: string;
  questions: string;
  selectedPassages: SelectedPassage[];
  createdAt: string;
  updatedAt: string;
}
export interface KnowledgeNote {
  id: string;
  title: string;
  markdown: string;
  path: string;
  createdAt: string;
  updatedAt: string;
  tags: string[];
}
export interface EvidenceRef {
  sourceId: string;
  start?: number;
  end?: number;
  quote?: string;
}
export interface ProposedChange {
  id: string;
  operation: "create_note" | "patch_note";
  knowledgeId: string;
  title: string;
  before: string;
  after: string;
  rationale: string;
  evidence: EvidenceRef[];
  decision: "pending" | "accepted" | "rejected";
}
export interface SynthesisProposal {
  id: string;
  sourceId: string;
  createdAt: string;
  model: string;
  summary: string;
  whyItMatters: string;
  outcome: "changes" | "no_change";
  changes: ProposedChange[];
  questions: string[];
  status: "pending" | "accepted" | "partially_accepted" | "rejected";
}
export interface SearchResult {
  id: string;
  chunkId: string;
  title: string;
  excerpt: string;
  path: string;
  score: number;
  lexicalScore: number;
  semanticScore: number;
  sourceId?: string;
  start?: number;
  end?: number;
  type: "knowledge" | "source" | "transcript" | "reflection" | "document";
}
export interface TimelineEvent {
  id: string;
  at: string;
  sourceId: string;
  title: string;
  type:
    | "encountered"
    | "kept"
    | "ignored"
    | "deferred"
    | "synthesized"
    | "integrated";
}
export interface ModelConfig {
  /** Response-only indicator; the saved API key is never returned to the UI. */
  apiKeyConfigured?: boolean;
  baseUrl: string;
  model: string;
  apiKey?: string;
  contextWindow?: number;
  timeoutSeconds?: number;
  maxOutputTokens?: number;
}
export interface AppSettings {
  vaultPath: string;
  inference: ModelConfig;
  embeddings: ModelConfig;
  gitAutoCommit: boolean;
  network: { youtube: boolean; inference: boolean; embeddings: boolean };
}
export interface Job {
  id: string;
  type: string;
  sourceId?: string;
  state:
    | "queued"
    | "running"
    | "waiting_for_user"
    | "completed"
    | "failed"
    | "cancelled";
  createdAt: string;
  updatedAt: string;
  error?: string;
  errorCode?: string;
  traceId?: string;
}
export interface RunTraceEvent {
  at: string;
  type: string;
  data: unknown;
}
export interface AgentRunOptions {
  trace?: (type: string, data: unknown) => Promise<void>;
  /** Injectable budgets for deterministic failure tests. */
  limits?: { timeoutMs?: number; turns?: number; tools?: number };
}
export interface SourceDetail {
  source: Source;
  transcript: Transcript | null;
  reflection: Reflection | null;
  proposals: SynthesisProposal[];
  related: SearchResult[];
}
export interface Health {
  ok: boolean;
  vaultPath: string;
  version: string;
}
export interface AgentContext {
  source: Source;
  transcript: Transcript | null;
  reflection: Reflection;
  related: SearchResult[];
}
export interface AgentTools {
  search(query: string): Promise<SearchResult[]>;
  read(id: string): Promise<KnowledgeNote | null>;
}
export interface AgentRunResult {
  proposal: SynthesisProposal;
  audit: {
    model: string;
    promptVersion: string;
    startedAt: string;
    completedAt: string;
    toolCalls: { name: string; summary: string }[];
    usage?: { input: number; output: number };
  };
}
/** Read-only imported Markdown; keep separate from synthesized knowledge. */
export interface DocumentDetail {
  id: string;
  title: string;
  markdown: string;
  path: string;
}

/** Progress for the current metadata backfill, excluding on-demand image downloads. */
export interface MetadataProgress {
  enabled: boolean;
  total: number;
  completed: number;
  incomplete: number;
  queued: number;
  active: number;
  estimatedRemainingSeconds: number | null;
}

export { releaseDay, videoGroups } from "./video-list";
export interface SourcePage {
  groups: Array<{
    key: string;
    label: string;
    total: number;
    videos: Source[];
  }>;
  counts: { inbox: number; later: number; all: number };
  total: number;
  page: number;
  pages: number;
  pageSize: number;
}
