import { localDay, twelveMonthsAgo } from "./history";
import { send, type ViewState } from "./protocol";
const el = <T extends HTMLElement = HTMLElement>(id: string) =>
  document.getElementById(id) as T;
let busy = false;
async function refresh() {
  const state = await send<ViewState>({ type: "state" });
  const run = state.run;
  el("pairing").hidden = state.connected;
  el("connected").hidden = !state.connected;
  el("address").textContent = state.endpoint ?? "";
  el<HTMLButtonElement>("start").disabled =
    busy || !state.connected || run?.status === "running";
  el("start").textContent = run
    ? "Start a new 12-month sync"
    : "Import last 12 months";
  el("resume").hidden = !state.connected || run?.status !== "paused";
  el("pause").hidden = run?.status !== "running";
  el<HTMLButtonElement>("forget").disabled = run?.status === "running";
  el("range").textContent =
    `${run?.cutoff ?? twelveMonthsAgo(localDay())} through ${run?.through ?? localDay()} · all videos in this date range`;
  el("progress").hidden = !run;
  if (run) {
    el("run-status").textContent =
      run.status === "paused"
        ? "PARTIAL IMPORT / PAUSED"
        : run.status.toUpperCase();
    el("counts").textContent =
      `${run.added} added · ${run.known} already known`;
    el("oldest").textContent = run.oldest
      ? `Oldest date reached: ${run.oldest} · ${run.batches} batches saved`
      : "Waiting for dated history entries…";
    el("reason").textContent = run.reason;
  }
}
async function action(fn: () => Promise<unknown>) {
  if (busy) return;
  busy = true;
  el("error").hidden = true;
  for (const button of document.querySelectorAll("button"))
    button.disabled = true;
  try {
    await fn();
  } catch (error) {
    el("error").textContent =
      error instanceof Error ? error.message : "Please retry.";
    el("error").hidden = false;
  } finally {
    busy = false;
    for (const button of document.querySelectorAll("button"))
      button.disabled = false;
    await refresh().catch(showError);
  }
}
function showError(error: unknown) {
  el("error").textContent = String(error);
  el("error").hidden = false;
}
el("pair-form").addEventListener("submit", (event) => {
  event.preventDefault();
  void action(async () => {
    await send({
      type: "pair",
      endpoint: el<HTMLInputElement>("endpoint").value,
      code: el<HTMLInputElement>("code").value.trim(),
    });
    el<HTMLInputElement>("code").value = "";
  });
});
for (const type of ["open-history", "start", "resume", "pause", "forget"])
  el(type).addEventListener("click", () => {
    void action(() => send({ type }));
  });
void refresh().catch(showError);
setInterval(() => {
  if (!busy) void refresh().catch(showError);
}, 2000);
