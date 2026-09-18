# Companion and retrieval implementation

The companion exports `createCompanion(options)` from `apps/companion/src/index.ts`. The executable is `bun apps/companion/src/main.ts`; the root development runner supplies its environment. `options` requires `vaultPath` and a token of at least 24 characters, and accepts `port` (default 4317), `allowedOrigins`, plus test-only injectable metadata/transcript/model functions. Production synthesis imports `synthesize` from `@repo/kb-agent`; there is no mock production fallback.

## Runtime and dependencies

- Bun 1.3+, built-in `bun:sqlite` with FTS5; no database server or vector extension.
- Workspace dependencies: `@repo/kb-shared`, `@repo/kb`, `@repo/ingestion`, `@repo/search`, `@repo/kb-agent`.
- Development: `@types/bun`, TypeScript. Manifests added only within assigned packages; coordinator owns workspace install and lockfile.
- `KB_VAULT_PATH` selects the vault (default `./vault`); browser input never selects a filesystem root.
- `KB_COMPANION_TOKEN` is required. `KB_COMPANION_PORT` defaults to 4317. `KB_ALLOWED_ORIGINS` is an optional comma-separated exact origin allowlist (defaults localhost/127.0.0.1 port 3000).
- Bind address is always `127.0.0.1`; Host must match localhost or 127.0.0.1 and the actual listening port. Every route including health needs Bearer auth. Absent Origin is allowed for the authenticated server proxy; foreign Origin is denied. JSON requests have a streamed 2 MiB limit and the listener also enforces that limit. The listener allows 180-second idle requests for synthesis.

## REST behavior

Implements every route in `contracts.md`. IDs are validated and delegated to the vault's independent path and symlink protections. Service errors are JSON and do not return provider response bodies or credentials. Network/settings validation is server-side. API keys are persisted only in `.kb/settings.json` (mode 0600), omitted from settings responses, and blank keys retain the current secret. Inference is called only for kept sources with a nonempty why reflection and an explicitly configured model.

Additional backwards-compatible behaviors:

- `GET /documents/:id` returns the canonical imported document by stable ID, including title, Markdown and relative path.
- No-change rejection: `POST /proposals/:id/review {decisions:[],rejectNoChange:true}`; `acceptNoChange:true` remains supported. Exactly one must be true.
- `GET /health` includes `retrieval: {mode, reason?, embeddingModel?}`.
- Successful HTTP responses expose `X-KB-Retrieval-Mode` and optional `X-KB-Retrieval-Reason`; these distinguish actual hybrid retrieval from lexical fallback.
- `createCompanion` returns `{vault,state,index,fetch,rebuild,start,close}`. `start()` returns the Bun server; stop it before `close()` when embedding the service.

## Writes, concurrency and restart

All HTTP mutations are serialized. Reviews validate all decision IDs/actions, pending states, target identities, before-text, edited Markdown and evidence before knowledge publication. The vault batch method validates/stages all canonical serializations and performs compare-and-swap checks before publishing. Duplicate target selections conflict, unknown/already-reviewed selections conflict, stale text conflicts, and rejected selections never write knowledge. Granular review can continue reviewing pending selections after an earlier partial decision.

Accepted Markdown is user-editable, but leading YAML frontmatter is rejected and application-generated provenance is always appended. Links preserve stable source ID, exact second range, a timestamped YouTube URL, and local source/transcript references. Editing accepted knowledge through the explicit PUT endpoint preserves identity and current file location.

Jobs and settings persist atomically under `.kb`. Interrupted queued/running jobs become failed with a retry explanation on restart, and `synthesis_pending` sources recover to kept. Accepted multi-file reviews write a private `.kb/review.json` recovery journal before publication. Startup (or the next mutation after a storage error) completes only explicitly approved writes whose old or already-published text still matches, records the proposal/source/timeline, then removes the journal. A conflicting manual edit blocks recovery rather than being overwritten. The vault uses atomic per-file publication, not an OS-level multi-file transaction; the journal closes the restart gap. If a manual edit conflicts with an interrupted review, an operator must resolve the journal or restore the intended text; do not discard this file blindly.

Git defaults off. When enabled, only exact accepted `knowledge/` paths are staged and committed using `git commit --only -- <paths>`; unrelated staged entries remain staged and do not enter the commit. Hooks and commit signing are disabled for this automated local commit, and there is no push. Git identity/configuration failures report that accepted files remain saved. Crash recovery restores accepted Markdown and proposal state but does not retry an optional commit interrupted after publication.

## Retrieval

`SearchIndex(path, embeddingOptions)` builds a disposable SQLite FTS5 index. Canonical vault scans include knowledge, documents, sources, reflections, and timestamped transcript segments. Heading-aligned text is split at 1800 characters when necessary; chunk IDs derive deterministically from stable artifact ID, timestamp, text hash, and duplicate occurrence. Filename changes do not alter IDs.

Configured OpenAI-compatible embeddings POST to `<baseUrl>/embeddings` in bounded batches with a 20-second timeout, no redirects, response-size limits, and vector validation. Stored records include vector/model endpoint identity/dimensions/content hash/generation time. Query ranking combines normalized lexical rank (45%) and cosine similarity (55%); without usable matching embeddings it is lexical-only. Disabled/unconfigured/unavailable/malformed embeddings always expose a lexical reason. Changing the embedding model requires a rebuild before semantic search is enabled.

Startup rebuilds from Markdown; normal writes refresh the index. Manual external edits require `POST /index/rebuild` or `bun apps/companion/src/rebuild.ts` (`KB_VAULT_PATH` supported; local CLI does not start a listener or require a token). Close the companion before deleting `.kb/search.sqlite` and any SQLite sidecars; restarting rebuilds without losing canonical files. Filesystem watching and incremental embedding reuse are deferred; full rebuilds favor correctness for the first slice.

## Verification

Run:

```sh
bun test apps/companion/src/companion.test.ts packages/search/src/search.test.ts
bunx tsc -p apps/companion/tsconfig.json --noEmit
bunx tsc -p packages/search/tsconfig.json --noEmit
```

Verified result: **12 tests pass, 103 assertions; both scoped TypeScript checks pass**.

The current suite covers real loopback HTTP, token/Origin/Host rejection, traversal, oversized content, transcript import, reflection gates, key redaction, durable jobs/settings/source recovery, rejected knowledge unchanged, edited acceptance provenance, all-before-write validation, concurrent/stale approvals, granular/no-change decisions, interrupted multi-note review recovery, deterministic database rebuild/reopen/deletion, semantic ranking/provider failure, and exact-path Git isolation with unrelated staged content. Tests use fixtures only for external caption/model transports. Coordinator integration additionally exercises production Pi over a local OpenAI-compatible fixture HTTP endpoint and the browser UI.
