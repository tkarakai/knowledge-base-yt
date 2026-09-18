# Vault and ingestion API — first slice

Imports: `@repo/kb`, `@repo/ingestion`; domain types from `@repo/kb-shared`. Bun runtime, Node filesystem APIs. Package dependency: **yaml ^2.8.1** in @repo/kb; coordinator must run workspace install. No ingestion runtime dependencies.

```ts
const vault = new Vault(absoluteOrRelativeConfiguredRoot);
await vault.init(); // Promise<void>; creates layout, rejects symlink roots/parents
vault.root: string; // absolute configured root
await vault.listSources(): Promise<Source[]>;
await vault.getSource(id: string): Promise<Source | null>;
await vault.saveSource(source: Source): Promise<string>; // relative changed file path
await vault.getTranscript(sourceId: string): Promise<Transcript | null>;
await vault.saveTranscript(transcript: Transcript): Promise<string>;
await vault.getReflection(sourceId: string): Promise<Reflection | null>;
await vault.saveReflection(reflection: Reflection): Promise<string>;
await vault.listKnowledge(): Promise<KnowledgeNote[]>;
await vault.getKnowledge(id: string): Promise<KnowledgeNote | null>;
await vault.saveKnowledge(note: KnowledgeNote): Promise<string>;
await vault.listProposals(): Promise<SynthesisProposal[]>;
await vault.getProposal(id: string): Promise<SynthesisProposal | null>;
await vault.saveProposal(proposal: SynthesisProposal): Promise<string>;
await vault.appendTimeline(event: TimelineEvent): Promise<string>;
await vault.listTimeline(): Promise<TimelineEvent[]>;
await vault.importDocument({title, markdown, filename?}): Promise<{id:string;path:string}>;
await vault.saveAudit({id, sourceId, proposalId?, ...agentResult.audit}): Promise<string>;
await vault.scan(): Promise<VaultScanEntry[]>;
await vault.applyKnowledgeBatch(changes: Array<{note:KnowledgeNote;expectedBefore:string|null}>): Promise<string[]>;
await vault.internalPath(filename:string): Promise<string>; // safe fixed basename under .kb/
```

`VaultScanEntry = {id:string; type:'knowledge'|'source'|'transcript'|'reflection'|'document'; title:string; markdown:string; path:string; sourceId?:string; segments?:TranscriptSegment[]}`. Transcripts expose segments for timestamp-aware indexing. Scan rebuilds from Markdown every time, including renamed files. Recognized files are validated; malformed records and duplicate IDs throw `VaultError` (code `VALIDATION`, `PATH_UNSAFE`, `CONFLICT`, `TOO_LARGE`). Missing ID lookups return null. IDs are colon-separated safe ASCII identifiers; they are never interpreted as paths. Knowledge paths are relative within `knowledge/`; use `path:''` for default ID-derived path. Saving an existing ID follows its current file path even after rename. Caller controls dates/status and authorizes knowledge changes; vault validates but never performs synthesis or acceptance itself. Individual file writes are atomic; multiple-file acceptance requires companion coordination.

Markdown uses `schema: kb/<kind>/v1` plus snake_case YAML metadata. Knowledge/document content and timestamped transcript body are canonical and editable; reflection text is editable YAML with a Markdown reading view. Proposal structured changes and audit summaries reside in readable YAML metadata with a human-readable Markdown view. Unknown frontmatter fields survive updates. Canonical writes are bounded at 2 MiB per file; regular local files only, no symlinks. Ignored hidden entries and unrelated untyped Markdown do not break scans; import untyped documents through `importDocument`.

```ts
normalizeYouTubeUrl(input: string): {videoId:string;url:string;sourceId:string};
fetchYouTubeMetadata(videoId: string, options?: NetworkOptions): Promise<YouTubeMetadata>;
// YouTubeMetadata = {videoId,url,title,channel,publishedAt?:string,error?:string}
// Failed metadata returns a truthful video-ID fallback with error; never blocks source creation.
parseUserTranscript(text: string, sourceId: string, language?: string): Transcript;
// WebVTT/SRT or [00:01] text / 00:01 text. Strict timestamp validation.
interface TranscriptProvider { name: string; fetch(videoId: string, language?: string): Promise<Transcript> }
new YouTubeCaptionProvider(options?: NetworkOptions): TranscriptProvider;
// Real YouTube watch-page caption tracks + timedtext JSON3. Missing/blocked/failing captions
// return explicit unavailable/requires_user_action/failed with empty segments and a recoverable error.
// NetworkOptions = {fetch?:typeof globalThis.fetch;timeoutMs?:number;maxBytes?:number;networkEnabled?:boolean}
```

Network requests use hardcoded HTTPS YouTube endpoints, reject redirects and untrusted caption URLs, and enforce timeouts and streamed size limits. Caller can inject fetch in tests and disable network via settings. No fabricated transcripts; manual imports are identified as `user-import`.

Batch writes validate all inputs and compare expected bodies before publishing; null means create only. They share a per-root in-process mutation lock with individual saves. All files are staged and synced first, then each rename is atomic; a disk failure or process crash between renames can partially publish the batch, so companion must retain accepted proposal decisions for recovery. Returned internal paths require revalidation immediately before use; portable Node path checks cannot prevent a hostile local process racing ancestor directory replacements. Roots with symlink ancestors are rejected (on macOS resolve OS temporary-directory aliases before configuring a temporary vault).

## Canonical file details

- Source IDs are `youtube:<11-character-video-id>`, with canonical watch URLs; knowledge/document IDs have their corresponding prefix. Other record IDs permit colon-separated ASCII letters, numbers, underscores and hyphens, capped at 180 characters.
- Knowledge and document Markdown bodies are authoritative. The writer preserves their supplied body text; reading normalizes CRLF line endings. Reflection text, selected passages, proposal changes, timeline events and audit summaries are authoritative in YAML; their body is a generated reading view. Edit reflection YAML to change reflection fields.
- Transcript bodies use `## HH:MM:SS.mmm --> HH:MM:SS.mmm` headings. Times retain millisecond precision; finer precision is rejected rather than rounded silently. User imports support WebVTT, SRT, `[MM:SS.mmm] text`, `MM:SS text` and explicit ranges. Missing end times use the next start; the final unknown end remains equal to its start and represents a point, not an inferred duration.
- Default records live in `sources/youtube/<videoId>/{source,transcript,reflection}.md`, `knowledge/<id>.md`, `documents/<id>.md`, `proposals/<id>.md`, `history/<eventId>.md`, and `agent-runs/<id>.md`; filename colons become underscores. IDs in frontmatter remain authoritative after renames. History uses one immutable event per Markdown file, with chronological `listTimeline()` ordering.
- Generated writes reject existing untyped files, duplicate IDs, nonregular files, hard links, symlinks and hidden knowledge paths. Scanning ignores hidden files/directories and untyped Markdown; explicit document import creates canonical metadata for existing document text. Invalid typed files produce a visible error rather than silent omission.
- `IngestionError.code === 'INVALID_INPUT'` maps to HTTP 400. Returned metadata fallbacks use the video ID as title and blank channel plus `error`; publication dates are omitted when the oEmbed endpoint does not provide them. No publication timestamp is invented.

## Validation evidence — 2026-09-16

`bun test packages/kb packages/ingestion`: **39 passed, 0 failed, 219 assertions**. `bunx eslint packages/kb/src packages/ingestion/src --quiet` passed. Both `bunx tsc --noEmit -p packages/kb/tsconfig.json` and the corresponding ingestion command passed. Tests cover deterministic serialization; Unicode/YAML validation; knowledge and reflection manual edits; file rename identity; transcript millisecond anchors; every durable record kind; separate-process restart; derived-state deletion; clearing stale transcript errors after retry; traversal, symlink and hard-link defenses; malformed and oversized content; all-before-write batch comparisons; and cross-instance concurrent compare-and-swap.

Ingestion tests use injected transport fixtures to exercise actual watch-page caption-track and JSON3 response shapes, creator/automatic caption selection, language fallback, unsafe caption URL rejection, HTTP errors, missing/restricted/empty captions, malformed timestamps, size limits, response-body timeouts, network-disabled operation, successful retry and independent manual import. The adapter never evaluates watch-page scripts.

A live smoke request for video `dQw4w9WgXcQ` retrieved the title `Rick Astley - Never Gonna Give You Up (Official Video) (4K Remaster)` and channel `Rick Astley`. Caption tracks were discoverable, but YouTube returned an empty timedtext response; the adapter returned `requires_user_action`, zero segments and a manual-import message. This verifies honest live failure handling, not guaranteed automated caption access. The unauthenticated caption endpoint can require browser verification and is not a stable public API; [yt-dlp's upstream issue about caption access](https://github.com/yt-dlp/yt-dlp/issues/13075) documents this constraint. No cookies, authentication bypass or fabricated text are used.

Remaining integration responsibility: companion owns the accepted-review journal and recovery for storage interruption between multiple atomic note replacements. The vault provides all-before-write validation and per-file atomicity, not a multi-file filesystem transaction or cross-process mutation lock.
