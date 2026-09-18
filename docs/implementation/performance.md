# Performance checks and budgets

The companion exposes authenticated, local-only `GET /metrics`; the same data is available under **Settings → Performance**. It reports p50/p95/max durations for the last 200 requests per normalized operation, lifetime request/error counts, write-queue wait, process memory, event-loop delay (100 ms sampling, last 30 seconds), vault scans/file reads/cache hits, and metadata/image queues. No source IDs, titles, search strings, tokens, or remote telemetry are recorded. Counters reset on restart. `Server-Timing: companion;dur=…` appears on JSON API responses in browser developer tools; it includes companion queueing and serialization but excludes Next proxy and browser time.

Run these from the repository root:

```sh
bun run test:kb:perf
bun run test:kb:perf:browser
```

The required `Commonplace validation` GitHub Actions workflow runs these checks on every pull request and preserves timing reports/screenshots for seven days. The standalone `KB performance` workflow remains available for manual development-server investigations.

Both use disposable synthetic vaults and injected providers, never the personal vault or live YouTube. The HTTP benchmark covers 2,500 and 10,000 videos while a deterministic, two-worker metadata backfill is active. It measures full response-body latency for pages, grouped substring search, details, knowledge, proposals, timeline, search, progress, settings, and reflection writes. It also checks that backfill actually overlaps the measured requests and that hot-path file reads stay bounded. `KB_PERF_SIZES=5000,20000 bun run test:kb:perf` overrides fixture sizes for investigation.

The browser check uses Chromium and the real Next proxy/companion against 2,500 and 10,000 extra sources. It checks first-page display, five pagination/search interactions per size (reporting p50/p95), full-library substring search, and a maximum of 50 rendered video rows. CI uses the production build so compilation and development instrumentation do not distort the budget. To reproduce that mode, run `bun run build:kb` followed by `KB_E2E_PRODUCTION=1 bun run test:kb:perf:browser`. The local default uses the development server; each report records its runtime. These synthetic timings are not production Core Web Vitals.

Reports are written to `.kb-local/performance/latest.json` and `browser.json` (ignored by Git). Preserve these as CI artifacts or compare them before/after a change. Use the same machine/runtime for comparisons; timings are machine dependent. Absolute budgets deliberately allow headroom for shared runners:

| Operation | Budget |
| --- | ---: |
| HTTP page, grouped search, source detail p95 | 250 ms |
| HTTP knowledge/proposals/timeline/search/progress/settings p95 | 150 ms |
| HTTP reflection write during backfill p95 | 500 ms |
| Page response | 128 KiB, at most 50 videos |
| Cold companion start at 10,000 videos | 15 seconds |
| Browser first page | 3 seconds |
| Browser next page / substring search | 1.5 seconds |

Tests exit nonzero when budgets are exceeded. Treat a failure as a regression to investigate before raising a budget. Network-provider delays are intentionally excluded from foreground timings by running backfill concurrently with a bounded fake provider. Real YouTube throttling still affects backfill completion time.

## Storage and rendering contract

Markdown remains authoritative. The companion opts into a rebuildable in-memory catalog; ordinary Vault callers retain strict scan-on-read behavior. App writes update the catalog immediately after atomic publication. Direct record reads validate and re-read only the target file; moved/deleted targets trigger reconciliation. Lists reconcile external edits in the background on the next access after five seconds. The inbox refresh button explicitly reconciles immediately, and explicit search-index rebuild also refreshes from disk. Knowledge compare-and-swap batches reconcile before validating and still check files again before publication. Cached listings can be briefly stale after an external editor change; direct known-file reads are immediate.

Reconciliation coalesces scans, uses bounded filesystem concurrency, and reuses parsed records only when device/inode/size/modification/change timestamps match. File reads allocate in bounded chunks rather than 2 MiB for every small Markdown file. Symlink/hardlink validation, atomic writes, unknown frontmatter, and manual-rename behavior are retained and tested.

`GET /sources/page?tab=inbox|later|all&page=1&q=…&group=channel|none` searches/sorts the full catalog before slicing 50 videos. Counts describe the full result, including full channel totals when a group spans pages. The original `/sources` route remains a bulk compatibility endpoint; the inbox does not poll it. Source links disable speculative prefetching; the browser refreshes only the current page and debounces search by 180 ms. Metadata uses two workers and uncached images use four separate slots; saved images bypass the remote queue.

## Initial measurements

Before this change, the personal 2,727-video vault took roughly 1.5–1.8 seconds per list request through the Next proxy, including empty Knowledge and Review lists. The full source response was about 1.98 MB. The synthetic HTTP benchmark after the change measured a 10,000-video page p95 around 35 ms, details around 27 ms, reflection writes around 135 ms, and roughly 25 KB per page on the development machine. These are different workloads and transport paths; use the generated benchmark reports for repeatable comparisons.

A follow-up measurement through the same Next development proxy on the personal 2,727-video vault returned a paginated listing in 34 ms median (40 ms p95, 49.7 KB), the bulk compatibility listing in 70 ms median, and empty Knowledge/Review lists in 30–31 ms median. These five-sample warm measurements exclude the first request; the HTTP scale benchmark above is the controlled active-backfill check.
