# Transcript retrieval and synthesis diagnostics

Research and local verification: 2026-09-17.

## Transcript decision

Use **yt-dlp 2026.08.19** as the primary caption extractor. The existing watch-page scraper finds caption URLs but receives an empty body for the failing local example. On the same machine and video (`oPZLPUtmROo`), yt-dlp retrieved English automatic captions without cookies. The integrated helper produced 1,924 timestamped text segments. This is a live result, not a fixture or a claim that every YouTube video has captions.

The live app subsequently retrieved and saved transcripts for all seven previously kept videos (15–1,924 segments each), without cookies. Two traced synthesis runs hit the 120-second deadline while making valid tool calls, without a context rejection or submission-validation error. The transcript navigation prompt was adjusted to expose duration/opening/closing passages and discourage exhaustive paging. The local workspace's synthesis budget was increased to 300 seconds for continued validation; the application default remains 120 seconds.

The longer run exposed actual invalid submissions: the model used `patch_note` as an outcome and a `youtube:` source ID as a knowledge ID; its next attempt used `no_change` with a nonempty change list and an invalid double-colon knowledge ID. Validation prevented all writes. Prompt version `kb-synthesis/v2` separates editable knowledge from reference material, explains these constraints explicitly, and includes a concrete submission example. This is evidence of contract-following errors as well as slow execution, not evidence that context was exhausted.

The subsequent live run used the correct create-note operation, outcome and knowledge ID, but an evidence quote did not match its cited transcript range. It attempted to reread that range and ultimately hit the 300-second deadline. The application returned the categorized timeout, and the retained trace also shows the quote-validation failure. No proposal or knowledge note was published by these failed tests. The configured Gemma model has **not** yet demonstrated a reliable successful synthesis in these live runs; retrieval and observability fixes should not be confused with proof of model quality.

| Option | Evidence and decision |
| --- | --- |
| [yt-dlp](https://github.com/yt-dlp/yt-dlp/releases/tag/2026.08.19) | The August release includes YouTube client updates and fallbacks. Selected after a successful live subtitle fetch. Pin the tested release and retest before upgrades. |
| [youtube-transcript-api](https://github.com/jdepoix/youtube-transcript-api#cookie-authentication) | Useful transcript-specific API, but its current README explicitly says cookie authentication is unavailable. Its [PO-token issue](https://github.com/jdepoix/youtube-transcript-api/issues/592) also describes empty caption responses. Not selected as the session-based fix. |
| [YouTube.js](https://github.com/LuanRT/YouTube.js) | An InnerTube client rather than a maintained replacement for our whole extraction pipeline. An alternative worth testing if the chosen extractor stops working; not independently validated in this change. |
| Existing browser extension | Could acquire the transcript from a signed-in watch page without exporting cookies, but currently imports history only. That transcript path is not implemented or claimed to work. |

The [yt-dlp PO-token guide](https://github.com/yt-dlp/yt-dlp/wiki/PO-Token-Guide) distinguishes player, media and subtitle tokens. Cookies alone are not a universal fix. The guide recommends maintained token-provider plugins, including `bgutil-ytdlp-pot-provider` and `yt-dlp-getpot-wpc`, when required. Do not hard-code a temporary token or permanently pin a particular YouTube client as a workaround.

## Setup and use

```sh
bun run setup:transcripts
bun run dev:kb
```

Setup installs a repository-local Python environment in `.kb-local/transcripts`, using uv and Python 3.11 when available. The fallback requires a system Python supported by yt-dlp (3.10+). Nothing is installed automatically during a caption request. `KB_TRANSCRIPT_PYTHON` can select another interpreter with yt-dlp installed.

Open a source and choose **Retry captions**. The helper selects an original-language track where possible, prefers the requested language and human captions, downloads only caption text, and parses YouTube JSON3 into timestamped segments. It never downloads audio/video. The process has a 90-second deadline and bounded output. Errors distinguish unavailable captions, access challenges, process timeout and malformed output. Failed retries preserve a previously saved transcript.

For a video requiring your signed-in session, start the companion with:

```sh
KB_YTDLP_COOKIES_FROM_BROWSER=chrome bun run dev:kb
```

Supported browser names: `chrome`, `edge`, `firefox`, `safari`, `brave`, `chromium`. Cookie loading is opt-in; the anonymous path is the default. yt-dlp reads/decrypts the selected browser's local cookie store. The app does not export cookie files or return cookies to its UI/model. OS keychain permission may be needed. This authenticated path has not been live-verified here because the tested videos worked anonymously. For extraction restrictions and account considerations, consult [yt-dlp's YouTube guidance](https://github.com/yt-dlp/yt-dlp/wiki/Extractors#youtube).

If caption access still fails, inspect **Settings → Recent activity → View communication trace**. Upgrade/retest the extractor or configure an upstream PO-token provider in the selected Python environment as appropriate. A video with no captions still needs manual transcript import or a future speech-to-text provider; neither cookies nor an LLM can recover missing source evidence by themselves.

## What synthesis expects

The model receives an OpenAI-compatible streaming chat-completions request with a system prompt, source metadata, your reflection, retrieval candidates, and five tool definitions: `kb_search`, `kb_read`, `source_read`, `reflection_read`, `submit_synthesis`.

Success requires a **`submit_synthesis` tool call**, not a JSON block or prose in the final answer. Its schema requires `summary`, `whyItMatters`, `outcome`, `changes`, and `questions`. Each change specifies a create/patch operation, knowledge ID, title, before/after Markdown, rationale and evidence. Validation also checks existing-note conflicts, exact quotes and timestamp ranges. `no_change` with an empty changes array is a valid result. All changes remain pending human review.

The model sees validation failures as tool results and can correct them. If it ends with plain text without submitting, the application sends one explicit submission reminder within the same total time/turn budget. It never silently treats prose as an accepted proposal.

## Trace location and contents

Open **Settings → Recent activity → View communication trace**. Expand individual events or choose **Download JSONL**. The backing files are:

```text
vault/.kb/jobs.json
vault/.kb/traces/<trace-id>.jsonl
```

Traces persist both successful and failed runs. Events include the actual provider request payload (messages and tool schemas), HTTP status/request ID/timing, bounded error response bodies, assistant text and tool arguments, tool outputs/validation failures, reported usage, raw streaming response text, configured budgets and final failure category. A bounded partial-response preview is saved at most every two seconds while the model generates. Context estimates include instructions and schemas; character-based estimates are labeled as estimates, not actual tokenizer counts. Model-reported usage is separate; the run's input total includes cached input.

Known model/companion credentials and credential fields are redacted; headers are not dumped. Source passages, reflections and model outputs are intentionally retained locally. Files use mode 0600 and the trace directory uses 0700. The newest 100 traces are retained, with 20 MiB per run and 2 MiB per event limits; truncation is explicit. Raw response capture is capped at one million characters per request. Streaming response bodies are finalized when the run settles, while message/tool events are written as they complete. A process crash can leave a partial trace; its job is marked interrupted on restart.

| Failure code | Meaning |
| --- | --- |
| `TIMEOUT` | Total synthesis wall-clock budget expired. |
| `CONTEXT_LIMIT` | Application context estimate or provider context limit rejected the request. |
| `OUTPUT_LIMIT` | The final model response was truncated by its output-token budget. |
| `PROVIDER_ERROR` | Provider HTTP, transport or runtime failure; inspect HTTP/body events. |
| `INVALID_PROPOSAL` | The model attempted submission but schema/evidence validation failed. |
| `NO_SUBMISSION` | The model stopped without a valid submit call, including after the reminder. |
| `TURN_LIMIT` / `TOOL_LIMIT` | The bounded agent exhausted its turns/tool calls. |
| `ABORTED` | The provider/agent aborted independently of a recorded timeout. |

**Settings → Reasoning model** exposes context window, output-token budget and total synthesis time budget. Match the context window to the model server's actual configuration. A successful **Check connection** verifies a short chat reply; it does not certify tool calling or synthesis quality. The trace provides the evidence needed before changing models or increasing budgets.

The companion disables its socket idle deadline for synthesis, and the proxy uses an explicit 630-second request deadline rather than [Bun's default five-minute fetch idle deadline](https://bun.com/reference/globals/BunFetchRequestInit/timeout), so configured runs can return their actual categorized failure.

The local oMLX provider writes its own log to `~/Library/Application Support/oMLX/logs/server.log`. This is useful for server load, request timing and provider configuration, alongside the application's trace.
