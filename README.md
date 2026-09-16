# Commonplace — personal knowledge from YouTube

A local-first knowledge workspace built on [web-app-starter](https://github.com/tkarakai/web-app-starter). Capture a video, reflect on what mattered, compare it with existing notes, and review proposed Markdown changes before accepting them.

**Markdown is the durable source of truth.** Sources, timestamped transcripts, reflections, knowledge notes, proposals, encounter history, and synthesis audits live in your vault. SQLite search indexes can be rebuilt. Pi receives only application-specific read/search/submit tools and cannot write the vault.

## Run locally

Requires Bun 1.3.6+ and Node 22.19+.

```sh
bun install
bun run dev:kb
```

Open **http://127.0.0.1:3001/kb**. This starts the Next.js web workspace and the local companion; it does not require a Convex account or cloud model. The original starter apps and Convex backend remain available through the starter scripts, but are not required by this first slice.

The default vault is `./vault`, which is ignored by this repository. To choose another directory:

```sh
KB_VAULT_PATH=/absolute/path/to/my-vault bun run dev:kb
```

Use a real directory, not a symlink. The launcher creates an ephemeral companion authentication token and shares it only between the server processes. Both services bind to loopback. `KB_WEB_PORT` and `KB_COMPANION_PORT` override ports 3001 and 4317. For manual server starts, supply the same strong `KB_COMPANION_TOKEN` to both servers and set `KB_COMPANION_URL` on Next.

## First workflow

1. Paste a YouTube URL into the inbox. Metadata and available captions are saved to Markdown. If captions are unavailable, import WebVTT, SRT, or timestamped text from the source screen.
2. Choose **Keep**, explain why, select important passages, and save your reflection. **Ignore** and **Later** preserve encounter history without invoking synthesis.
3. Import existing Markdown documents from the knowledge workspace. In **Settings**, configure an OpenAI-compatible inference base URL and a model with tool-calling support. A local server may use `http://127.0.0.1:11434/v1`; enter the actual model installed on your server.
4. Choose **Propose connections**. Pi retrieves prior knowledge and submits changes for review. Review the before/after text, edit proposed Markdown if needed, then accept or reject each change.
5. Search your vault and follow source timestamps. Configure a separate embedding endpoint/model and enable embeddings for hybrid retrieval. Without usable embeddings, search explicitly falls back to lexical retrieval.

YouTube and configured model calls are controlled in Settings. No inference model is selected automatically. API keys remain in local companion settings and are not returned to the browser. Caption availability depends on YouTube and the video's caption access; manual import remains available.

## Vault and rebuild

```text
vault/
  sources/youtube/<video-id>/{source,transcript,reflection}.md
  knowledge/*.md
  documents/*.md
  proposals/*.md
  history/*.md
  agent-runs/*.md
  .kb/                 # local settings, jobs, derived SQLite index
```

Stable IDs live in frontmatter, so moving or renaming a note does not change its identity. Knowledge bodies and transcript text remain human editable. After changing files outside the application, use **Rebuild index** or:

```sh
KB_VAULT_PATH=/absolute/path/to/my-vault bun run kb:rebuild
```

Back up the Markdown vault. Treat `.kb/settings.json` as private configuration because it may contain model credentials. The optional Git setting creates local commits for accepted knowledge files only; it never pushes. For a separately versioned vault, run `git init` inside it before enabling Git integration.

## Checks

```sh
bun run test:kb          # vault, ingestion, retrieval, Pi, companion
bun run typecheck:kb
bun run lint:kb
bun run build:kb         # production Next build with local starter URL defaults
bun run test:kb:e2e      # real browser + companion + Pi, local fixture providers
bun run test:unit        # React UI and starter regression tests
bun run test:convex      # inherited backend tests
```

The browser test requires a Playwright Chromium installation (`bunx playwright install chromium`). Its model/caption fixtures are test-only; production never substitutes fake synthesis or transcript content.

## Scope

This is the first implementation slice, not completion of every PRD milestone. Browser-history capture, browser extensions, non-Markdown document conversion, targeted external research, and a Convex workflow-state mirror are deferred. The local companion currently owns workflow state while canonical artifacts stay portable. Review writes validate all changes before publication and atomically replace individual files; multiple files are not one filesystem transaction. An approval journal lets an interrupted accepted review resume on restart.

See [the PRD](docs/personal-knowledge-base-prd.md), [implementation contracts](docs/implementation/contracts.md), [vault API](docs/implementation/vault-api.md), and [the original starter documentation](docs/starter-readme.md).
