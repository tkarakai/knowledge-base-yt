import type { Vault } from "@repo/kb";
import {
  youtubeChannelUrl,
  youtubeImageUrl,
  type Source,
  type VideoImageKind,
  type MetadataProgress,
} from "@repo/kb-shared";
import {
  fetchYouTubeMetadata,
  fetchYouTubePublication,
  fetchYouTubeChannelAvatar,
} from "@repo/ingestion";
import { ApiError } from "./state";

export interface MediaOptions {
  background?: boolean;
  fetch?: typeof fetch;
  metadata?: typeof fetchYouTubeMetadata;
  publication?: typeof fetchYouTubePublication;
  channelAvatar?: typeof fetchYouTubeChannelAvatar;
}
const MAX_IMAGE = 1024 * 1024;
function imageType(bytes: Uint8Array): "jpg" | "png" | "webp" | undefined {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpg";
  if ([137, 80, 78, 71, 13, 10, 26, 10].every((n, i) => bytes[i] === n))
    return "png";
  const text = new TextDecoder("ascii").decode(bytes.subarray(0, 12));
  if (text.startsWith("RIFF") && text.slice(8, 12) === "WEBP") return "webp";
  return undefined;
}
export const imageMime = (extension: string) =>
  extension === "jpg"
    ? "image/jpeg"
    : extension === "png"
      ? "image/png"
      : "image/webp";

function missingDetails(source: Source) {
  return (
    (!source.publishedOn && !source.publishedAt) ||
    !source.channel?.trim() ||
    (!source.thumbnailUrl && !source.thumbnailPath)
  );
}

export class SourceMedia {
  private completed = 0;
  private incomplete = 0;
  private total = 0;
  private durations: number[] = [];
  private checked = new Set<string>();
  private pending = new Map<string, Source>();
  private active = new Set<string>();
  private images = new Map<
    string,
    Promise<{ bytes: Uint8Array; extension: string }>
  >();
  private channels = new Map<string, Promise<string | undefined>>();
  private downloads = new Map<
    string,
    Promise<{
      bytes: Uint8Array;
      extension: "jpg" | "png" | "webp";
      path: string;
    }>
  >();
  private stopped = false;
  private imageActive = 0;
  private imageWaiters: Array<() => void> = [];
  private async imageSlot<T>(work: () => Promise<T>): Promise<T> {
    if (this.imageActive >= 4)
      await new Promise<void>((resolve) => this.imageWaiters.push(resolve));
    else this.imageActive++;
    try {
      return await work();
    } finally {
      const next = this.imageWaiters.shift();
      if (next) next();
      else this.imageActive--;
    }
  }
  imageStatus() {
    return { active: this.imageActive, queued: this.imageWaiters.length };
  }
  constructor(
    private vault: Vault,
    private enabled: () => boolean,
    private patch: (id: string, patch: Partial<Source>) => Promise<void>,
    private options: MediaOptions = {},
  ) {}
  close() {
    this.stopped = true;
    this.pending.clear();
  }
  status(): MetadataProgress {
    const remaining = this.pending.size + this.active.size;
    const mean =
      this.durations.reduce((sum, value) => sum + value, 0) /
      this.durations.length;
    return {
      enabled: this.enabled(),
      queued: this.pending.size,
      active: this.active.size,
      total: this.total,
      completed: this.completed,
      incomplete: this.incomplete,
      estimatedRemainingSeconds:
        remaining && this.durations.length >= 3
          ? Math.max(
              1,
              Math.ceil((mean * remaining) / Math.min(2, remaining) / 1000),
            )
          : null,
    };
  }
  enqueue(sources: Source[], retryMissing = false) {
    if (!this.enabled() || this.stopped || this.options.background === false)
      return this.status();
    const running = this.pending.size > 0 || this.active.size > 0;
    const eligible = sources.filter((source) => {
      const due =
        !source.metadataCheckedAt ||
        Date.now() - Date.parse(source.metadataCheckedAt) > 86400000;
      return (
        missingDetails(source) &&
        (retryMissing || due) &&
        !this.active.has(source.id) &&
        !this.pending.has(source.id) &&
        !(running && this.checked.has(source.id))
      );
    });
    if (eligible.length && !running) {
      this.total = 0;
      this.completed = 0;
      this.incomplete = 0;
      this.durations = [];
      this.checked.clear();
    }
    for (const source of eligible) {
      this.pending.set(source.id, source);
      this.total++;
    }
    this.pump();
    return this.status();
  }
  private pump() {
    if (this.stopped || !this.enabled()) return;
    while (this.active.size < 2 && this.pending.size) {
      const [id, source] = this.pending.entries().next().value!;
      this.pending.delete(id);
      this.active.add(id);
      const started = Date.now();
      void this.enrich(source)
        .then((incomplete) => {
          if (incomplete) this.incomplete++;
        })
        .catch(() => {
          this.incomplete++;
        })
        .finally(() => {
          this.completed++;
          this.checked.add(id);
          this.durations.push(Date.now() - started);
          if (this.durations.length > 30) this.durations.shift();
          this.active.delete(id);
          this.pump();
        });
    }
  }
  private async enrich(source: Source) {
    const current = await this.vault.getSource(source.id);
    if (!current || !missingDetails(current)) return false;
    source = current;
    const network = {
      fetch: this.options.fetch,
      networkEnabled: this.enabled(),
      timeoutMs: 8000,
    };
    const [metadata, publication] = await Promise.allSettled([
      !source.channel?.trim() || (!source.thumbnailUrl && !source.thumbnailPath)
        ? (this.options.metadata ?? fetchYouTubeMetadata)(
            source.videoId,
            network,
          )
        : Promise.resolve(undefined),
      !source.publishedOn && !source.publishedAt
        ? (this.options.publication ?? fetchYouTubePublication)(
            source.videoId,
            network,
          )
        : Promise.resolve(undefined),
    ]);
    const patch: Partial<Source> = {
      metadataCheckedAt: new Date().toISOString(),
    };
    if (
      metadata.status === "fulfilled" &&
      metadata.value &&
      !metadata.value.error
    ) {
      const m = metadata.value;
      if (m.channel) patch.channel = m.channel;
      if (youtubeChannelUrl(m.channelUrl))
        patch.channelUrl = youtubeChannelUrl(m.channelUrl);
      if (youtubeImageUrl(m.thumbnailUrl, "thumbnail"))
        patch.thumbnailUrl = youtubeImageUrl(m.thumbnailUrl, "thumbnail");
      if (m.publishedAt) patch.publishedAt = m.publishedAt;
      if (m.publishedOn) patch.publishedOn = m.publishedOn;
    }
    if (publication.status === "fulfilled" && publication.value)
      patch.publishedOn = publication.value;
    if (
      !patch.publishedOn &&
      !patch.publishedAt &&
      !source.publishedOn &&
      !source.publishedAt
    )
      patch.metadataError =
        "YouTube did not provide a release date. Retry metadata later.";
    else patch.metadataError = undefined;
    if (!this.stopped) await this.patch(source.id, patch);
    return missingDetails({ ...source, ...patch });
  }
  private async download(url: string) {
    const response = await (this.options.fetch ?? fetch)(url, {
      redirect: "error",
      credentials: "omit",
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok || response.redirected || !response.body)
      throw new ApiError(404, "Image unavailable");
    if (Number(response.headers.get("content-length")) > MAX_IMAGE) {
      await response.body.cancel();
      throw new ApiError(413, "Image too large");
    }
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > MAX_IMAGE) throw new ApiError(413, "Image too large");
        chunks.push(value);
      }
    } finally {
      await reader.cancel().catch(() => {});
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    const extension = imageType(bytes);
    if (!extension) throw new ApiError(415, "Unsupported image format");
    return { bytes, extension };
  }
  async get(id: string, kind: VideoImageKind): Promise<Response> {
    const key = `${id}:${kind}`;
    let work = this.images.get(key);
    if (!work) {
      work = this.load(id, kind);
      this.images.set(key, work);
      void work.finally(() => this.images.delete(key)).catch(() => {});
    }
    const { bytes, extension } = await work;
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": imageMime(extension),
        "Content-Length": String(bytes.byteLength),
        "Cache-Control": "private, max-age=86400",
        "X-Content-Type-Options": "nosniff",
      },
    });
  }
  private async load(id: string, kind: VideoImageKind) {
    const source = await this.vault.getSource(id);
    if (!source) throw new ApiError(404, "Source not found");
    const pathKey =
      kind === "thumbnail" ? "thumbnailPath" : "channelAvatarPath";
    if (source[pathKey]) {
      try {
        return {
          bytes: await this.vault.readImage(source[pathKey]),
          extension: source[pathKey].split(".").pop()!,
        };
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
    }
    return this.imageSlot(() => this.loadRemote(source!, kind));
  }
  private async loadRemote(source: Source, kind: VideoImageKind) {
    if (!this.enabled() || this.stopped)
      throw new ApiError(404, "Image is not saved; YouTube access is disabled");
    const id = source.id;
    const pathKey =
      kind === "thumbnail" ? "thumbnailPath" : "channelAvatarPath";
    const urlKey = kind === "thumbnail" ? "thumbnailUrl" : "channelAvatarUrl";
    let url = youtubeImageUrl(source[urlKey], kind);
    if (kind === "thumbnail")
      url ??= `https://i.ytimg.com/vi/${source.videoId}/mqdefault.jpg`;
    if (!url && kind === "avatar") {
      if (!source.channelUrl) {
        const metadata = await (this.options.metadata ?? fetchYouTubeMetadata)(
          source.videoId,
          { fetch: this.options.fetch, networkEnabled: true, timeoutMs: 8000 },
        );
        const channelUrl = youtubeChannelUrl(metadata.channelUrl);
        if (channelUrl) {
          await this.patch(id, {
            channelUrl,
            ...(metadata.channel ? { channel: metadata.channel } : {}),
          });
          source = { ...source, channelUrl };
        }
      }
      const channel = youtubeChannelUrl(source.channelUrl);
      if (channel) {
        if (!this.channels.has(channel))
          this.channels.set(
            channel,
            (this.options.channelAvatar ?? fetchYouTubeChannelAvatar)(channel, {
              fetch: this.options.fetch,
              networkEnabled: true,
              timeoutMs: 8000,
            }).catch(() => undefined),
          );
        url = youtubeImageUrl(await this.channels.get(channel), "avatar");
      }
    }
    if (!url) throw new ApiError(404, "Channel image unavailable");
    if (!this.downloads.has(url)) {
      const download = this.download(url).then(async (image) => ({
        ...image,
        path: await this.vault.saveImage(image.bytes, image.extension),
      }));
      this.downloads.set(url, download);
      void download.catch(() => this.downloads.delete(url!));
      if (this.downloads.size > 128)
        this.downloads.delete(this.downloads.keys().next().value!);
    }
    const { bytes, extension, path } = await this.downloads.get(url)!;
    if (!this.stopped) await this.patch(id, { [pathKey]: path, [urlKey]: url });
    return { bytes, extension };
  }
}
