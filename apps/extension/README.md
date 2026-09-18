# Commonplace YouTube history importer

Build from the repository root with `bun run build:extension`. Load `apps/extension/dist` as an unpacked Chrome/Edge extension, then open it from the browser toolbar. Follow the [root setup guide](../../README.md#import-your-youtube-history).

## Import behavior

- A new sync fixes `through` to the user's current local calendar day and `cutoff` to 12 calendar months earlier (inclusive; February 29 clamps to February 28). Resume retains those bounds. There is no maximum number of videos or pages.
- The collector reads the signed-in, rendered `/feed/history` page, including watch and Shorts links within dated history sections. It scrolls the continuation into view and clicks a continuation button when YouTube provides one. It never calls undocumented authenticated YouTube APIs.
- English Today/Yesterday/weekday and month/day headings are supported, including explicit and inferred years. Unrecognized or out-of-order headings pause the scan without importing the ambiguous section. `hl=en` requests English when opening history; if your account overrides this, change YouTube's language to English and resume.
- Only dates provided by history sections are recorded. A date does not imply an exact watch time or duration. Watch dates are stored in source frontmatter under `history.watched_on`; discovery timestamps remain import timestamps.
- History entries also include safe thumbnail, channel URL, and avatar URLs when present in the rendered row (including lazy image attributes). The companion can discover absent avatars from public channel metadata. Re-syncs enrich existing source metadata without resetting decisions or adding encounters. Publication dates are separately fetched by the companion; listings use publication dates exclusively, not the history section date.
- Up to 100 entries travel per HTTP batch; this is a transport limit, not an import threshold. The companion validates and filters dates again, normalizes identity, and creates only new sources across all inbox decisions. Captions are on demand to avoid fetching a year's transcripts during import.
- Each batch is saved in extension storage before transmission. Lost acknowledgements replay the same batch ID; the companion keeps the latest 256 receipts. Source IDs prevent duplication even if a receipt is evicted or a process stops midway through writing a batch. In that rare case, the replay can count earlier writes as already known instead of newly added.
- Progress, submitted IDs, cutoff, and a pending batch survive service worker suspension and browser restarts. Resume can rescan the loaded feed or a reopened page; it skips acknowledged IDs. A new sync reloads the history tab and intentionally scans the date window again so it can discover recent or missed entries. It never stops just because it encounters an existing source.
- A stalled continuation pauses after 40 seconds without new content. End-of-feed completion requires dated content, no continuation/loading indicator, and multiple settled observations. Empty/unsupported pages pause with instructions instead of claiming completeness. YouTube may change its markup; an authenticated real-account smoke test is still needed on each materially different layout.

## Authentication boundary

Google authentication happens on YouTube in the user's normal browser profile. The extension has host access only to YouTube and loopback hosts, plus `storage` and `scripting`. There is no `cookies`, browser `history`, debugger, or all-sites permission.

Commonplace Settings issues a random, single-use pairing code, valid for five minutes. The extension exchanges it on `/history/pair`, receiving a credential bound to its extension ID. That credential only authorizes `/history/batches`. The server stores its hash in `.kb/history-connection.json`, and extension storage is restricted to trusted extension contexts. Content scripts receive neither the credential nor the companion's master token. Collector messages are accepted only from the selected history tab's top frame during the current import attempt.

The existing localhost web proxy stays same-origin and does not expose extension-only routes. The dedicated importer checks Host, extension origin when provided, extension ID, token, body limits, batch size, and entry fields. Only a locally authenticated web request can issue pairing codes or revoke the connection. Settings' YouTube network toggle also blocks history imports.

The extension's Forget button clears its saved credential/progress. Revoke access in Commonplace Settings to invalidate the server credential. Re-pairing replaces the previously connected extension.

## Validation and future hosting

`bun run test:history:e2e` uses a real Chromium MV3 extension and the real companion with synthetic, paginated YouTube DOM fixtures. It covers a 211-video import spanning the cutoff, an acknowledgement lost after persistence, safe retry, repeat sync, decision preservation, an unknown-date pause, end-of-feed completion, and stalled-pagination detection. It does not authenticate a real Google account or prove compatibility with every YouTube experiment.

This version sends to a local companion only. The shared batch contract separates collection from ingestion, but a future cloud endpoint needs user-scoped authentication/storage and corresponding extension host permissions; merely deploying today's local web proxy is insufficient.
