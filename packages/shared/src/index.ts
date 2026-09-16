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
  publishedAt?: string;
  firstSeenAt: string;
  lastSeenAt: string;
  status: SourceStatus;
  transcriptStatus: TranscriptStatus;
  encounters: string[];
  tags: string[];
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
  baseUrl: string;
  model: string;
  apiKey?: string;
  contextWindow?: number;
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
