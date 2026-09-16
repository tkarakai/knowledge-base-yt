# First vertical slice contracts

Base: tkarakai/web-app-starter at 16879ba4c141c24bb296a534428353e48fdbb591. Keep starter packages/apps; add a local KB workspace in apps/web at /kb with its own layout, outside locale auth. Root coordinator owns root scripts/config/shared types, packages/agent, integration and documentation.

## Worker ownership
- Vault worker: packages/kb and packages/ingestion, including tests.
- Service worker: apps/companion and packages/search, including tests.
- Web worker: apps/web KB pages/components/styles and KB API proxy, tests. May adjust proxy.ts for /kb and /api/kb bypass and layout if needed, preserve starter routes.

All agents share this working directory. Do not commit, overwrite another scope, modify root package/lock, or spawn nested workers. Notify coordinator of required dependency additions. Use packages/shared/src/index.ts (@repo/kb-shared) for domain types. Propose additions through coordinator.

## Local API (JSON)
Companion listens 127.0.0.1:4317; requires Authorization: Bearer KB_COMPANION_TOKEN on all routes (including health). Next /api/kb/[...path] proxies server-side with token; browser never receives companion token. Reject foreign Origin at both layers. Host allowlist. Body <= 2 MiB. KB_VAULT_PATH explicitly configured through env (default ignored ./vault). Browser cannot select arbitrary filesystem paths.

- GET /health -> Health
- GET /sources -> Source[]
- POST /sources {url:string} -> SourceDetail
- GET /sources/:id -> SourceDetail (ids URL encoded)
- PUT /sources/:id/reflection {decision,why,reaction,questions,selectedPassages} -> SourceDetail
- PUT /sources/:id/transcript {text:string,language?:string} -> SourceDetail; accepts timestamped plain text or WebVTT through ingestion adapter
- POST /sources/:id/transcript/retry -> SourceDetail
- POST /sources/:id/synthesize -> SynthesisProposal (synchronous await for first slice, job tracked)
- GET /proposals -> SynthesisProposal[]
- POST /proposals/:id/review {decisions:Array<{changeId:string,action:'accept'|'reject',markdown?:string}>} -> SynthesisProposal. Only accepted selections write knowledge; validate all before writes; stale before text must cause conflict. Empty no_change proposal may be accepted with {decisions:[],acceptNoChange:true}.
- GET /knowledge -> KnowledgeNote[]
- GET /knowledge/:id -> KnowledgeNote
- PUT /knowledge/:id {markdown:string,title?:string} -> KnowledgeNote (explicit user editing; preserve identity)
- POST /documents {title:string,markdown:string,filename?:string} -> {id:string}
- GET /search?q=... -> SearchResult[]
- POST /index/rebuild -> {chunks:number}
- GET /timeline -> TimelineEvent[]
- GET /jobs -> Job[]
- GET /settings -> AppSettings (redacted API keys, blank means unchanged on update)
- PUT /settings {inference?,embeddings?,gitAutoCommit?,network?} -> AppSettings. Vault path env-only.
- Errors: {error:string} with appropriate HTTP code; no secrets or absolute arbitrary file contents.

## Package contracts
Vault worker must publish contracts quickly (docs/implementation/vault-api.md). Export Vault class (async init, source list/get/save, transcript get/save, reflection get/save, knowledge list/get/save, proposal list/get/save, timeline append/list, document import, audit save, scan for search). Canonical Markdown is durable; protect path traversal and symlinks; read stable IDs from frontmatter on every scan; deterministic serializers and atomic writes. Vault API can differ in details but document promptly for service worker.

Ingestion exports normalizeYouTubeUrl(url)->{videoId,url,sourceId}, fetchYouTubeMetadata(videoId), transcript provider interface + caption adapter with graceful failure, parseUserTranscript(text,sourceId,language?). All network timeouts and size limits; no arbitrary URL fetching.

Agent package exports synthesize(context:AgentContext,tools:AgentTools,config:ModelConfig):Promise<AgentRunResult>; validates proposals; Pi core runtime, restricted read/search/submit tools, no filesystem or shell. Root will implement.

Service worker owns settings loading and supplies inference API key only server-side. Synthesis never runs for ignored/deferred or reflection-less sources. Write audit/proposal as Markdown, never hidden chain-of-thought. Optional Git add/commit only exact changed vault files and do not include unrelated staged files. Never auto-push. Search SQLite FTS5 + OpenAI-compatible embeddings configurable; network-disabled/unconfigured embeddings report lexical fallback honestly.

No fake production data or mock synthesis. Test fixtures may inject transcript/model transport. First slice must work with failed captions via manual timestamped transcript import. No browser extension yet.

Integration extension: GET /documents/:id -> DocumentDetail {id,title,markdown,path}, looked up by stable ID from vault scan. Imported-document search results open /kb/documents/:id (read-only original Markdown preview), not the knowledge-note edit route. This keeps document and knowledge provenance distinct.
