import { localDay, scanHistory } from "./history";
import { send, type Run } from "./protocol";

// Executed in an isolated world; reads rendered history, never cookies or page JS.
const scope = globalThis as typeof globalThis & {
  commonplaceHistory?: AbortController;
};
scope.commonplaceHistory?.abort();
const controller = new AbortController();
scope.commonplaceHistory = controller;
const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));
void collect().catch(() => {}); // Failures are reported to the importer below.

async function collect() {
  const run = await send<Run>({ type: "collector-ready" });
  const seen = new Set(run.submitted);
  const base = { runId: run.id, attempt: run.attempt };
  let signature = "",
    changedAt = Date.now(),
    stableEnd = 0;
  try {
    while (!controller.signal.aborted) {
      if (location.pathname !== "/feed/history")
        throw new Error(
          "The history tab navigated away. Open history and resume.",
        );
      await send({ type: "heartbeat", ...base });
      if (
        document.querySelector(
          'ytd-browse[page-subtype="history"] a[href*="accounts.google.com/ServiceLogin"]',
        )
      )
        throw new Error("Sign in on YouTube, then resume the import.");
      const root = document.querySelector('ytd-browse[page-subtype="history"]');
      if (!root) {
        if (Date.now() - changedAt > 25_000)
          throw new Error(
            "History did not load. Sign in on YouTube and resume.",
          );
        await sleep(1500);
        continue;
      }
      const scan = scanHistory(root, run.cutoff, run.through, localDay());
      const fresh = scan.entries.filter((entry) => !seen.has(entry.videoId));
      for (let offset = 0; offset < fresh.length; offset += 100) {
        if (controller.signal.aborted) return;
        const entries = fresh.slice(offset, offset + 100);
        await send({ type: "batch", ...base, entries, oldest: scan.oldest });
        for (const entry of entries) seen.add(entry.videoId);
      }
      if (scan.error) throw new Error(scan.error);
      if (scan.reachedCutoff) {
        await send({
          type: "finish",
          ...base,
          oldest: scan.oldest,
          reason: "Reached the 12-month cutoff.",
        });
        return;
      }
      if (scan.signature !== signature) {
        signature = scan.signature;
        changedAt = Date.now();
        stableEnd = 0;
      }
      // Require loaded, dated content and repeated settled observations before declaring end.
      const loading = root.querySelector(
        "tp-yt-paper-spinner[active], tp-yt-paper-spinner-lite[active]",
      );
      if (
        signature &&
        !scan.continuation &&
        !loading &&
        document.readyState === "complete"
      )
        stableEnd++;
      else stableEnd = 0;
      if (stableEnd >= 5 && Date.now() - changedAt >= 8000) {
        await send({
          type: "finish",
          ...base,
          oldest: scan.oldest,
          reason: "Reached the end of the available history.",
        });
        return;
      }
      if (Date.now() - changedAt > 40_000)
        throw new Error(
          "YouTube stopped loading older history. Import is partial; resume to retry. If history is empty or paused, there may be nothing to import.",
        );
      // Trigger YouTube’s own continuation, preserving its signed-in session.
      if (scan.continuation) {
        scan.continuation.scrollIntoView({ block: "end" });
        const button =
          scan.continuation.querySelector<HTMLButtonElement>("button");
        if (button && !button.disabled) button.click();
      }
      window.scrollTo(0, document.documentElement.scrollHeight);
      await sleep(2000);
    }
  } catch (error) {
    if (!controller.signal.aborted)
      await send({
        type: "pause-result",
        ...base,
        reason:
          error instanceof Error
            ? error.message
            : "Import interrupted. Resume to retry.",
      }).catch(() => {});
  }
}
