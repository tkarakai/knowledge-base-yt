import type { HistoryBatch, HistoryBatchResult } from "@repo/kb-shared";
export interface Run {
  id: string;
  attempt: string;
  cutoff: string;
  through: string;
  today: string;
  tabId: number;
  status: "running" | "paused" | "complete";
  reason: string;
  oldest?: string;
  heartbeat: number;
  added: number;
  known: number;
  batches: number;
  submitted: string[];
  pending?: HistoryBatch;
}
export interface Connection {
  endpoint: string;
  token: string;
}
export interface ViewState {
  connected: boolean;
  endpoint?: string;
  run?: Run;
}
export type Reply<T = unknown> =
  | { ok: true; value: T }
  | { ok: false; error: string };
export async function send<T = unknown>(message: unknown): Promise<T> {
  const reply: Reply<T> = await chrome.runtime.sendMessage(message);
  if (!reply?.ok)
    throw new Error(
      reply && "error" in reply
        ? reply.error
        : "Extension did not respond. Reopen the importer.",
    );
  return reply.value;
}
export type BatchReply = HistoryBatchResult;
