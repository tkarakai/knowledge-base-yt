import type { HistoryBatchResult, HistoryEntry } from "@repo/kb-shared";
import { localDay, twelveMonthsAgo } from "./history";
import type { Connection, Run, ViewState } from "./protocol";

const ready = chrome.storage.local.setAccessLevel({
  accessLevel: "TRUSTED_CONTEXTS",
});
let queue: Promise<unknown> = Promise.resolve();
function exclusive<T>(fn: () => Promise<T>) {
  const next = queue.then(fn, fn);
  queue = next.catch(() => {});
  return next;
}
chrome.action.onClicked.addListener(() => {
  void chrome.tabs.create({ url: chrome.runtime.getURL("panel.html") });
});
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  void exclusive(async () => {
    await ready;
    return handle(message, sender);
  }).then(
    (value) => respond({ ok: true, value }),
    (error) =>
      respond({
        ok: false,
        error: error instanceof Error ? error.message : "Import failed",
      }),
  );
  return true;
});
chrome.tabs.onRemoved.addListener((tabId) => {
  void exclusive(async () => {
    const { run } = await stored();
    if (run?.tabId === tabId && run.status === "running") {
      run.status = "paused";
      run.reason = "History tab closed. Open history and resume.";
      await save(run);
    }
  });
});
async function stored(): Promise<{
  connection?: Connection;
  run?: Run;
  historyTabId?: number;
}> {
  return chrome.storage.local.get(["connection", "run", "historyTabId"]);
}
async function save(run: Run) {
  await chrome.storage.local.set({ run });
}
function endpoint(value: unknown) {
  const url = new URL(String(value));
  if (
    url.protocol !== "http:" ||
    !["127.0.0.1", "localhost"].includes(url.hostname) ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  )
    throw new Error(
      "Use your local companion address, such as http://127.0.0.1:4317.",
    );
  return url.origin;
}
async function request<T>(
  connection: Connection,
  path: string,
  data: unknown,
): Promise<T> {
  const response = await fetch(`${connection.endpoint}${path}`, {
    method: "POST",
    credentials: "omit",
    redirect: "error",
    signal: AbortSignal.timeout(25_000),
    headers: {
      "Content-Type": "application/json",
      "X-KB-Extension-Id": chrome.runtime.id,
      ...(connection.token
        ? { Authorization: `Bearer ${connection.token}` }
        : {}),
    },
    body: JSON.stringify(data),
  });
  const result = await response.json();
  if (!response.ok)
    throw new Error(result.error ?? `Import failed (${response.status})`);
  return result;
}
async function flush(run: Run, connection: Connection) {
  if (!run.pending) return;
  const result = await request<HistoryBatchResult>(
    connection,
    "/history/batches",
    run.pending,
  );
  run.added += result.added;
  run.known += result.known;
  run.batches++;
  run.submitted = [
    ...new Set([
      ...run.submitted,
      ...run.pending.entries.map((entry) => entry.videoId),
    ]),
  ];
  delete run.pending;
  run.heartbeat = Date.now();
  await save(run);
}
const isHistory = (url: string | undefined) => {
  try {
    const parsed = new URL(url!);
    return (
      parsed.origin === "https://www.youtube.com" &&
      parsed.pathname === "/feed/history"
    );
  } catch {
    return false;
  }
};
async function historyTab(preferredId?: number) {
  const tabs = await chrome.tabs.query({
    url: "https://www.youtube.com/feed/history*",
  });
  const tab =
    tabs.find((tab) => tab.id === preferredId && isHistory(tab.url)) ??
    tabs.find((tab) => tab.active && isHistory(tab.url)) ??
    tabs.find((tab) => isHistory(tab.url));
  if (!tab?.id)
    throw new Error(
      "Open YouTube history first, sign in, and wait for your videos to appear.",
    );
  await chrome.tabs.update(tab.id, { active: true });
  return tab;
}
async function reloadHistory(tabId: number) {
  // A new sync must see videos watched since the last scan, not stale loaded DOM.
  await new Promise<void>((resolve, reject) => {
    const done = (error?: Error) => {
      clearTimeout(timer);
      chrome.tabs.onUpdated.removeListener(updated);
      if (error) reject(error);
      else resolve();
    };
    const updated = (id: number, change: chrome.tabs.OnUpdatedInfo) => {
      if (id === tabId && change.status === "complete") done();
    };
    const timer = setTimeout(
      () =>
        done(
          new Error(
            "YouTube did not finish loading. Check the history tab and resume.",
          ),
        ),
      30_000,
    );
    chrome.tabs.onUpdated.addListener(updated);
    void chrome.tabs.reload(tabId).catch((error) => done(error));
  });
}
async function handle(
  message: Record<string, unknown>,
  sender: chrome.runtime.MessageSender,
) {
  if (
    !message ||
    typeof message.type !== "string" ||
    sender.id !== chrome.runtime.id
  )
    throw new Error("Unknown extension request");
  const panel =
    sender.url === chrome.runtime.getURL("panel.html") && !sender.tab;
  // Extension pages opened as tabs can also carry a tab in their sender.
  const trustedPanel =
    panel || sender.url === chrome.runtime.getURL("panel.html");
  const state = await stored();
  if (trustedPanel) {
    if (message.type === "state") {
      if (
        state.run?.status === "running" &&
        Date.now() - state.run.heartbeat > 60_000
      ) {
        state.run.status = "paused";
        state.run.reason =
          "Import interrupted or tab suspended. Resume to continue safely.";
        await save(state.run);
      }
      // Never return the import credential or the full list of submitted IDs to the UI.
      return {
        connected: !!state.connection,
        endpoint: state.connection?.endpoint,
        run: state.run
          ? { ...state.run, submitted: [], pending: undefined }
          : undefined,
      } satisfies ViewState;
    }
    if (message.type === "pair") {
      if (state.run?.status === "running")
        throw new Error(
          "Pause the current import before changing connections.",
        );
      const connection = { endpoint: endpoint(message.endpoint), token: "" };
      const result = await request<{ token: string }>(
        connection,
        "/history/pair",
        { code: message.code },
      );
      connection.token = result.token;
      await chrome.storage.local.set({ connection });
      await chrome.storage.local.remove("run");
      return true;
    }
    if (message.type === "open-history") {
      const tab = await chrome.tabs.create({
        url: "https://www.youtube.com/feed/history?hl=en",
      });
      await chrome.storage.local.set({ historyTabId: tab.id });
      return tab.id;
    }
    if (message.type === "pause") {
      if (state.run) {
        state.run.status = "paused";
        state.run.reason =
          "Paused. Imported videos are saved; resume whenever you’re ready.";
        await save(state.run);
      }
      return true;
    }
    if (message.type === "forget") {
      if (state.run?.status === "running")
        throw new Error("Pause the import first.");
      await chrome.storage.local.remove(["connection", "run"]);
      return true;
    }
    if (message.type === "start" || message.type === "resume") {
      if (!state.connection) throw new Error("Pair with Commonplace first.");
      if (state.run?.status === "running")
        throw new Error(
          "An import is already running. Pause it before restarting.",
        );
      const tab = await historyTab(state.historyTabId ?? state.run?.tabId);
      const through = localDay();
      const run: Run =
        message.type === "resume" && state.run
          ? state.run
          : {
              id: crypto.randomUUID(),
              attempt: "",
              through,
              today: through,
              cutoff: twelveMonthsAgo(through),
              tabId: tab.id!,
              status: "paused",
              reason: "",
              heartbeat: Date.now(),
              added: 0,
              known: 0,
              batches: 0,
              submitted: [],
            };
      // Finish a possibly acknowledged request before attempting any new batches.
      await flush(run, state.connection);
      run.attempt = crypto.randomUUID();
      run.tabId = tab.id!;
      run.status = "running";
      run.reason = "Reading history and loading older dates…";
      run.heartbeat = Date.now();
      await save(run);
      try {
        if (message.type === "start") await reloadHistory(run.tabId);
        await chrome.scripting.executeScript({
          target: { tabId: run.tabId },
          files: ["content.js"],
        });
      } catch (error) {
        run.status = "paused";
        run.reason =
          "Could not read the YouTube tab. Reload history, sign in, then resume.";
        await save(run);
        throw error;
      }
      return true;
    }
    throw new Error("Unknown importer action");
  }
  const run = state.run;
  if (
    !run ||
    run.status !== "running" ||
    sender.tab?.id !== run.tabId ||
    sender.frameId !== 0 ||
    !isHistory(sender.url)
  )
    throw new Error("Import paused. Resume from the Commonplace extension.");
  if (message.type === "collector-ready") return run;
  if (message.runId !== run.id || message.attempt !== run.attempt)
    throw new Error(
      "Import was restarted; this collector is no longer active.",
    );
  run.heartbeat = Date.now();
  if (message.type === "heartbeat") {
    await save(run);
    return true;
  }
  if (message.type === "batch") {
    if (!state.connection) throw new Error("Pair the extension again.");
    await flush(run, state.connection);
    const seen = new Set(run.submitted);
    const entries = (message.entries as HistoryEntry[]).filter((entry) => {
      if (seen.has(entry.videoId)) return false;
      seen.add(entry.videoId);
      return true;
    });
    if (entries.length) {
      run.pending = {
        runId: run.id,
        batchId: crypto.randomUUID(),
        cutoff: run.cutoff,
        through: run.through,
        entries,
      };
      await save(run); // Durable before the network call; safe to replay after a crash.
      await flush(run, state.connection);
    }
    if (typeof message.oldest === "string") run.oldest = message.oldest;
    await save(run);
    return true;
  }
  if (message.type === "finish" || message.type === "pause-result") {
    if (message.type === "finish" && run.pending)
      throw new Error("An import batch is still pending. Resume to retry.");
    run.status = message.type === "finish" ? "complete" : "paused";
    run.reason = String(message.reason).slice(0, 1000);
    if (typeof message.oldest === "string") run.oldest = message.oldest;
    await save(run);
    return true;
  }
  throw new Error("Unknown collector action");
}
