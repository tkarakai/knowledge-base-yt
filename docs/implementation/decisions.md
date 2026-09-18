# First-slice decisions and verification

- Starter base: `tkarakai/web-app-starter` commit `16879ba4c141c24bb296a534428353e48fdbb591`; existing apps/backend retained. This repository has its own Git history.
- Local workspace uses `/kb` outside the starter's locale/auth shell so no cloud identity is required. Convex remains available; mirroring local workflow state is deferred.
- Markdown holds durable sources, transcripts, reflections, notes, documents, proposals, timeline events and agent audits. Jobs/settings use local private JSON; SQLite FTS5 and vectors are derived.
- The companion binds loopback and requires a bearer token. Next holds that token on the server; browser requests use a narrow same-origin operation proxy.
- Pi uses `@earendil-works/pi-agent-core` and `@earendil-works/pi-ai` pinned to 0.85.1. Only kb_search, kb_read, source_read, reflection_read and submit_synthesis are registered. No coding-agent plugins, ambient provider credentials, shell or filesystem tools are loaded.
- Model configuration supports a user-selected OpenAI-compatible endpoint. No paid or cloud model is chosen automatically. Evidence and proposal validation happen outside the model.
- Granular review uses full Markdown before/after snapshots with optimistic conflict detection. Accepted text gets application-generated source provenance. Rejected changes do not modify knowledge.
- Git is opt-in for this first slice. Only accepted knowledge files enter its local commit; no push. Personal vault content is excluded from this application repository by default.
- External file edits become searchable on restart or explicit index rebuild. A background filesystem watcher is deferred.
- Multi-file acceptance validates/stages all changes before publication; each rename is atomic, but the batch is not a crash-atomic transaction. The companion records an explicit approval journal and resumes interrupted accepted writes on restart; conflicting manual edits stop recovery for review.

## Verification record

Starter baseline: all 24 React unit tests and all 180 Convex tests passed. Existing app Bun unit/security tests passed. Agent tests exercise the actual Pi tool loop through a local OpenAI-compatible streaming HTTP fixture, strict proposal checks, prompt injection/tool allowlist, and reflection gating. The combined new backend suite passes 60 tests (346 assertions) and all five package typechecks. The rebuild CLI also passed an actual invocation. The Chromium end-to-end fixture passes capture, two saved selections, Pi tool calling, edit/accept/reject, document import/read, lexical search, cross-origin rejection, mobile overflow, and restart after deleting SQLite. Desktop/mobile screenshots were visually reviewed. `bun run build:kb` passes the full Next production build with inherited local starter URL defaults. The real dev launcher serves /kb and authenticated-proxy health successfully.

## Upstream references checked during implementation

- [Pi agent core](https://github.com/earendil-works/pi/tree/main/packages/agent) for custom tools and stopping hooks.
- [Pi model API](https://github.com/earendil-works/pi/tree/main/packages/ai) for OpenAI-compatible local model configuration.

## Remaining work after this checkpoint

- Configure and evaluate a real local reasoning/embedding model against personal sources; transport tests use deterministic local providers.
- Add background file watching and incremental embedding reuse for larger vaults.
- Extend segment selection to arbitrary text ranges, and add richer knowledge backlinks/relationship views.
- Add persistent question artifacts and targeted external research, then browser encounter capture.
- Mirror derived workflow state to Convex if reactive multi-surface coordination is needed; the local-first slice does not require it.

## Completed coordinated work

| Area | Outcome | Evidence |
| --- | --- | --- |
| Canonical vault and ingestion | Implemented | 39 tests; real YouTube metadata and honest unavailable-caption behavior |
| Companion and hybrid retrieval | Implemented | 12 tests; live HTTP, approval/restart recovery, embeddings, Git isolation |
| Web reflection and review | Implemented | 16 new tests; browser E2E; six desktop empty routes and mobile inbox passed axe A/AA checks |
| Pi and integration (coordinator) | Implemented | 9 agent tests; full browser loop through actual Pi runtime; production build |

Final combined checks: 60 backend tests, 80 web Bun tests (including 11 new proxy/diff tests), 26 React tests (including five new review tests), scoped lint, dependency frozen-lock install and production build all passed. Existing Convex baseline: 180 tests passed. UI acceptance uses deterministic test-only external providers; real local model quality remains to be evaluated with the user's chosen model.
