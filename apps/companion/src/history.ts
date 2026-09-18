import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { Vault } from "@repo/kb";
import type {
  HistoryBatch,
  HistoryBatchResult,
  HistoryConnection,
  Source,
} from "@repo/kb-shared";
import { youtubeChannelUrl, youtubeImageUrl } from "@repo/kb-shared";
import { ApiError, object, State, string } from "./state";

const digest = (text: string) =>
  createHash("sha256").update(text).digest("hex");
const equal = (a: string, b: string) =>
  timingSafeEqual(Buffer.from(digest(a)), Buffer.from(digest(b)));
const extensionId = /^[a-p]{32}$/;
interface Connection {
  extensionId: string;
  tokenHash: string;
  connectedAt: string;
  lastImportAt?: string;
  lastBatch?: HistoryBatchResult;
}
interface Receipt {
  key: string;
  hash: string;
  result: HistoryBatchResult;
}
function day(value: unknown): string {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d\d-\d\d$/.test(value) ||
    !Number.isFinite(Date.parse(value)) ||
    new Date(value).toISOString().slice(0, 10) !== value
  )
    throw new ApiError(400, "Expected a calendar date (YYYY-MM-DD)");
  return value;
}
function identifier(value: unknown): string {
  const text = string(value, "import identifier");
  if (!/^[a-zA-Z0-9-]{1,80}$/.test(text))
    throw new ApiError(400, "Invalid import identifier");
  return text;
}
function bounded(value: unknown, name: string, max: number) {
  const text = string(value, name, true).trim();
  if (text.length > max || text.includes("\0"))
    throw new ApiError(400, `Invalid ${name}`);
  return text;
}
export class HistoryImport {
  private pending?: { hash: string; expiresAt: number };
  constructor(
    private state: State,
    private vault: Vault,
  ) {}
  private async connection() {
    return (await this.state.readDocument(
      "history-connection",
    )) as Connection | null;
  }
  async status(): Promise<HistoryConnection> {
    const connection = await this.connection();
    return connection
      ? {
          connected: true,
          connectedAt: connection.connectedAt,
          lastImportAt: connection.lastImportAt,
          lastBatch: connection.lastBatch,
        }
      : { connected: false };
  }
  issueCode() {
    const code = randomBytes(18).toString("hex");
    const expiresAt = Date.now() + 5 * 60_000;
    this.pending = { hash: digest(code), expiresAt };
    return { code, expiresAt: new Date(expiresAt).toISOString() };
  }
  async disconnect() {
    this.pending = undefined;
    if (await this.connection())
      await this.state.removeDocument("history-connection");
    return { connected: false };
  }
  validateExtensionRequest(request: Request) {
    const id = request.headers.get("x-kb-extension-id") ?? "";
    const origin = request.headers.get("origin");
    if (
      !extensionId.test(id) ||
      (origin && origin !== `chrome-extension://${id}`)
    )
      throw new ApiError(403, "Extension origin not allowed");
    return id;
  }
  async pair(request: Request, raw: unknown) {
    const id = this.validateExtensionRequest(request);
    const { code } = object(raw);
    if (
      typeof code !== "string" ||
      !this.pending ||
      this.pending.expiresAt < Date.now() ||
      !equal(digest(code), this.pending.hash)
    )
      throw new ApiError(
        401,
        "Pairing code is invalid or expired. Generate a new code in Settings.",
      );
    this.pending = undefined;
    const token = randomBytes(32).toString("hex");
    await this.state.writeDocument("history-connection", {
      extensionId: id,
      tokenHash: digest(token),
      connectedAt: new Date().toISOString(),
    } satisfies Connection);
    return { token };
  }
  async authorize(request: Request) {
    const id = this.validateExtensionRequest(request);
    const connection = await this.connection();
    const bearer = request.headers.get("authorization") ?? "";
    if (
      !connection ||
      connection.extensionId !== id ||
      !bearer.startsWith("Bearer ") ||
      !equal(digest(bearer.slice(7)), connection.tokenHash)
    )
      throw new ApiError(
        401,
        "History connection expired or disconnected. Pair the extension again.",
      );
  }
  async batch(raw: unknown): Promise<HistoryBatchResult> {
    const data = object(raw);
    const runId = identifier(data.runId),
      batchId = identifier(data.batchId);
    const cutoff = day(data.cutoff),
      through = day(data.through);
    if (cutoff > through)
      throw new ApiError(400, "Import date range is reversed");
    if (!Array.isArray(data.entries) || data.entries.length > 100)
      throw new ApiError(400, "Send at most 100 entries per batch");
    const entries = data.entries.map((raw) => {
      const entry = object(raw);
      const videoId = string(entry.videoId, "video ID");
      if (!/^[A-Za-z0-9_-]{11}$/.test(videoId))
        throw new ApiError(400, "Invalid video ID");
      return {
        videoId,
        title: bounded(entry.title, "title", 1000),
        channel: bounded(entry.channel, "channel", 500),
        watchedOn: day(entry.watchedOn),
        ...(youtubeChannelUrl(entry.channelUrl)
          ? { channelUrl: youtubeChannelUrl(entry.channelUrl) }
          : {}),
        ...(youtubeImageUrl(entry.thumbnailUrl, "thumbnail")
          ? { thumbnailUrl: youtubeImageUrl(entry.thumbnailUrl, "thumbnail") }
          : {}),
        ...(youtubeImageUrl(entry.channelAvatarUrl, "avatar")
          ? {
              channelAvatarUrl: youtubeImageUrl(
                entry.channelAvatarUrl,
                "avatar",
              ),
            }
          : {}),
      };
    });
    const batch: HistoryBatch = { runId, batchId, cutoff, through, entries };
    const key = `${runId}:${batchId}`,
      hash = digest(JSON.stringify(batch));
    const receipts = ((await this.state.readDocument("history-receipts")) ??
      []) as Receipt[];
    const receipt = receipts.find((item) => item.key === key);
    if (receipt) {
      if (receipt.hash !== hash)
        throw new ApiError(
          409,
          "Batch identifier already used with different entries",
        );
      return receipt.result;
    }
    const at = new Date().toISOString();
    const eligible = entries.filter(
      (entry) => entry.watchedOn >= cutoff && entry.watchedOn <= through,
    );
    const sources: Source[] = eligible.map((entry) => ({
      id: `youtube:${entry.videoId}`,
      videoId: entry.videoId,
      url: `https://www.youtube.com/watch?v=${entry.videoId}`,
      title: entry.title || `YouTube video ${entry.videoId}`,
      channel: entry.channel,
      channelUrl: entry.channelUrl,
      thumbnailUrl: entry.thumbnailUrl,
      channelAvatarUrl: entry.channelAvatarUrl,
      firstSeenAt: at,
      lastSeenAt: at,
      encounters: [at],
      tags: [],
      status: "ready_for_reflection",
      transcriptStatus: "requires_user_action",
      history: { provider: "youtube-history", watchedOn: entry.watchedOn },
    }));
    const added = await this.vault.addNewSources(sources, true);
    const result = {
      added: added.length,
      known: eligible.length - added.length,
      outsideWindow: entries.length - eligible.length,
    };
    receipts.push({ key, hash, result });
    await this.state.writeDocument("history-receipts", receipts.slice(-256));
    const connection = await this.connection();
    if (connection)
      await this.state.writeDocument("history-connection", {
        ...connection,
        lastImportAt: at,
        lastBatch: result,
      });
    return result;
  }
}
