# Commonplace — personal knowledge from YouTube

A local-first knowledge workspace built on [web-app-starter](https://github.com/tkarakai/web-app-starter). Capture a video, reflect on what mattered, compare it with existing notes, and review proposed Markdown changes before accepting them.

**Markdown is the durable source of truth.** Sources, timestamped transcripts, reflections, knowledge notes, proposals, encounter history, and synthesis audits live in your vault. SQLite search indexes can be rebuilt. Pi receives only application-specific read/search/submit tools and cannot write the vault.

See [CONTRIBUTING.md](CONTRIBUTING.md) for the PR workflow and required validation.

## Run locally

Requires Bun 1.3.6+, Node 22.19+, Python 3.9+, and the `ps`, `pgrep`, and `lsof` utilities.

```sh
bun install
bun run setup:transcripts
bun run dev:kb
```

Open the **Knowledge Base** URL printed after Next.js is ready (normally **http://127.0.0.1:3001/kb**). This starts the Next.js web workspace and the local companion; it does not require a Convex account or cloud model. The original starter apps and Convex backend remain available through the starter scripts, but are not required by this first slice.

The default vault is `./vault`, which is ignored by this repository. To choose another directory:

```sh
KB_VAULT_PATH=/absolute/path/to/my-vault bun run dev:kb
```

Use a real directory, not a symlink. The launcher creates an ephemeral companion authentication token and shares it only between the server processes. Both services bind to loopback. The launcher chooses free ports starting at 3001 and 4317 and prints both addresses. `KB_WEB_PORT` and `KB_COMPANION_PORT` select exact ports; if occupied, startup fails before launching either service. For manual server starts, supply the same strong `KB_COMPANION_TOKEN` to both servers and set `KB_COMPANION_URL` on Next.

The optional starter launcher (`bun run dev`) records process identities per checkout. Its start/stop commands only stop verified services owned by this checkout, leaving other apps' servers alone. Because the starter web app and KB share a Next.js build directory, `dev:kb` stops this checkout's verified starter web instance before starting. An untracked instance must be stopped from its original terminal; changing ports does not release its build lock. See [development process isolation](docs/starter-readme.md#development-process-isolation) for details. The KB launcher manages its own child processes; stop it with Ctrl+C.

## First workflow

1. Paste a YouTube URL into the inbox. Metadata and available captions are saved to Markdown. If captions are unavailable, import WebVTT, SRT, or timestamped text from the source screen.
2. Choose **Keep**, explain why, select important passages, and save your reflection. **Ignore** and **Later** preserve encounter history without invoking synthesis.
3. Import existing Markdown documents from the knowledge workspace. In **Settings**, configure an OpenAI-compatible inference base URL and a model with tool-calling support. A local server may use `http://127.0.0.1:11434/v1`; enter the actual model installed on your server.
4. Choose **Propose connections**. Pi retrieves prior knowledge and submits changes for review. Review the before/after text, edit proposed Markdown if needed, then accept or reject each change.
5. Search your vault and follow source timestamps. Configure a separate embedding endpoint/model and enable embeddings for hybrid retrieval. Without usable embeddings, search explicitly falls back to lexical retrieval.

YouTube and configured model calls are controlled in Settings. No inference model is selected automatically. API keys remain in local companion settings and are not returned to the browser. Caption availability depends on YouTube and the video's caption access; manual import remains available.

Caption fetching uses a locally installed, pinned yt-dlp extractor. **Retry captions** on previously imported videos to populate missing transcripts. Optional browser-session support and the research behind this choice are in [transcripts and diagnostics](docs/implementation/transcripts-and-traces.md).

Failed model runs now retain communication traces: open **Settings → Recent activity → View communication trace**, or inspect `vault/.kb/traces/<trace-id>.jsonl`. These contain prompts, responses, tool results, validation failures, usage and stop reasons, with credential redaction. They include private source/reflection content; the latest 100 runs are retained. The reasoning settings expose context, output and time budgets.

## Compare alternative experiences

Choose **Experience lab** in the sidebar, or open **http://127.0.0.1:3001/kb/explore** (use your printed web port). Try **Workbench** for a compact source queue and editor, **Pipeline** for a visible capture-to-knowledge workflow, or **Library** for notes and topic browsing. All three use the same real vault; changes are shared. The original app stays available and remains the default. Mark a favorite to remember your preference in this browser.

See [the UX comparison guide](docs/implementation/ux-explorations.md) for tradeoffs and a suggested evaluation journey.

## Import your YouTube history

The Chrome/Edge extension imports videos from your signed-in YouTube history into the local inbox, using a **12-calendar-month date window**, with no total video-count limit. It scrolls/paginates until it reaches an older date or the end of the available history.

1. Run `bun run build:extension` and keep `bun run dev:kb` running.
2. Open `chrome://extensions` (or `edge://extensions`), enable **Developer mode**, choose **Load unpacked**, and select `apps/extension/dist`.
3. In Commonplace **Settings → YouTube history**, generate a pairing code.
4. Click the extension in your browser toolbar. Paste the code and connect. Use the **Companion** address printed by the launcher (normally `http://127.0.0.1:4317`).
5. Choose **Open YouTube history**, sign in directly on YouTube if needed, and check that the correct account's videos appear. The importer requests the English interface so date headings can be interpreted safely.
6. Return to the extension tab and select **Import last 12 months**. Keep the YouTube history tab open while it loads older pages. Progress, the oldest date reached, and **Pause / Resume** are in the extension tab.

Existing videos retain all decisions and encounter timestamps. New videos appear in the inbox; captions are fetched on demand using **Retry captions** on a source. The watch date displayed by YouTube is stored separately from the import timestamp. A repeated sync never treats the scan itself as another watch.

Video listings show the **release date**, newest first, across To reflect on, For later, and All sources. Enable **Group by channel** to keep that order within each channel, and use **Find a video** for case-insensitive substring matching on titles or channel names. Missing release dates are fetched from public YouTube publication metadata in the background; unknown dates sort last and never fall back to the watch/import date. The video-details panel shows live checked/queued counts, a spinner, and an estimated time remaining once several lookups finish. **Retry missing details** only retries incomplete videos, reuses existing fields, and skips complete or already queued videos. Progress counts metadata checks, including unavailable results; image downloads happen separately as videos come into view.

The extension also harvests thumbnail, channel-link, and channel-avatar URLs. The companion fills missing channel details from public metadata and saves displayed JPEG/PNG/WebP images in `vault/assets/`, referenced from source frontmatter. Saved images work offline. Images load as videos come into view, so importing a year's history does not block on downloading every image. Refresh the unpacked extension in Chrome/Edge after rebuilding it; a new history sync can enrich previously imported videos without changing their decisions.

Imports are incremental and retryable. Resume retains the original cutoff and safely replays any unacknowledged batch. If a tab is closed or suspended, reopen history and resume; earlier saved videos remain in the vault. Unknown date headings, sign-in problems, and stalled pagination produce a **partial / paused** result rather than a false success. History disabled/deleted in YouTube cannot be recovered by this importer.

Google passwords and cookies stay in the browser. A single-use, five-minute pairing code issues a revocable credential that can only submit history batches. **Disconnect** in Settings revokes it; the extension's **Forget** button only removes the local connection. No general browser-history or cookie permission is requested. See [extension details](apps/extension/README.md).

## Vault and rebuild

```text
vault/
  sources/youtube/<video-id>/{source,transcript,reflection}.md
  assets/<content-hash>.{jpg,png,webp}
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
bun run test:dev-scripts # starter process isolation across apps and worktrees
bun run typecheck:kb
bun run lint:kb
bun run build:kb         # production Next build with local starter URL defaults
bun run test:kb:e2e      # real browser + companion + Pi, local fixture providers
bun run test:kb:perf     # HTTP latency/payload/file-read budgets at 2,500 and 10,000 videos
bun run test:kb:perf:browser # real browser pagination/search scale budgets
bun run test:history:e2e # real MV3 extension + paginated YouTube fixtures + companion
bun run test:unit        # React UI and starter regression tests
bun run test:convex      # inherited backend tests
```

The browser test requires a Playwright Chromium installation (`bunx playwright install chromium`). Its model/caption fixtures are test-only; production never substitutes fake synthesis or transcript content.

## Performance

Video lists use 50-item pages; search, release-date sorting, and channel grouping apply across the entire library. **Settings → Performance** shows local request/queue timings, memory, and vault scan metrics. Repeatable scale tests, budgets, and cache behavior are documented in [Performance checks](docs/implementation/performance.md). Reports are saved under `.kb-local/performance/`.

## Scope

This is the first implementation slice, not completion of every PRD milestone. User-triggered YouTube history import is available through the local extension; continuous watch/playback capture, non-Markdown document conversion, targeted external research, and a Convex workflow-state mirror are deferred. The local companion currently owns workflow state while canonical artifacts stay portable. Cloud history ingestion is not implemented. Review writes validate all changes before publication and atomically replace individual files; multiple files are not one filesystem transaction. An approval journal lets an interrupted accepted review resume on restart.

See [the PRD](docs/personal-knowledge-base-prd.md), [implementation contracts](docs/implementation/contracts.md), [vault API](docs/implementation/vault-api.md), and [the original starter documentation](docs/starter-readme.md).
