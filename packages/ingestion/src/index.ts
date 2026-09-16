import type {
  Transcript,
  TranscriptSegment,
  TranscriptStatus,
} from "@repo/kb-shared";
export interface NetworkOptions {
  fetch?: typeof globalThis.fetch;
  timeoutMs?: number;
  maxBytes?: number;
  networkEnabled?: boolean;
}
export interface YouTubeMetadata {
  videoId: string;
  url: string;
  title: string;
  channel: string;
  publishedAt?: string;
  error?: string;
}
export interface TranscriptProvider {
  name: string;
  fetch(videoId: string, language?: string): Promise<Transcript>;
}
export class IngestionError extends Error {
  constructor(
    message: string,
    public readonly code = "INVALID_INPUT",
  ) {
    super(message);
    this.name = "IngestionError";
  }
}
const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const MAX_IMPORT_BYTES = 2 * 1024 * 1024;
function validateVideoId(id: string) {
  if (typeof id !== "string" || !VIDEO_ID.test(id))
    throw new IngestionError("Invalid YouTube video ID");
}
function validateLanguage(language: string) {
  if (!/^[A-Za-z]{2,8}(?:-[A-Za-z0-9]{1,8})*$/.test(language))
    throw new IngestionError("Invalid transcript language");
}
export function normalizeYouTubeUrl(input: string): {
  videoId: string;
  url: string;
  sourceId: string;
} {
  // Reject control characters before URL parsing, which otherwise silently strips them.
  // eslint-disable-next-line no-control-regex
  const invalidCharacters = /[\u0000-\u001f\\]/;
  if (
    typeof input !== "string" ||
    input.length > 4096 ||
    invalidCharacters.test(input)
  )
    throw new IngestionError("Invalid YouTube URL");
  const text = input.trim();
  let videoId: string;
  if (/%(?:2e|2f|5c)/i.test(text) || /\/(?:\.\.?)(?:\/|[?#]|$)/.test(text))
    throw new IngestionError(
      "Escaped or traversing YouTube paths are unsupported",
    );
  if (VIDEO_ID.test(text)) videoId = text;
  else {
    let url: URL;
    try {
      url = new URL(
        /^(?:www\.|m\.|music\.)?(?:youtube\.com|youtu\.be)\//i.test(text)
          ? `https://${text}`
          : text,
      );
    } catch {
      throw new IngestionError("Enter a YouTube video URL");
    }
    if (
      !["https:", "http:"].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.port
    )
      throw new IngestionError("Unsupported YouTube URL");
    const host = url.hostname.toLowerCase();
    if (host === "youtu.be" || host === "www.youtu.be") {
      const m = /^\/([A-Za-z0-9_-]{11})\/?$/.exec(url.pathname);
      videoId = m?.[1] ?? "";
    } else if (
      [
        "youtube.com",
        "www.youtube.com",
        "m.youtube.com",
        "music.youtube.com",
        "youtube-nocookie.com",
        "www.youtube-nocookie.com",
      ].includes(host)
    ) {
      if (url.pathname === "/watch" && !host.includes("nocookie")) {
        const ids = url.searchParams.getAll("v");
        if (ids.length !== 1) throw new IngestionError("Expected one video ID");
        videoId = ids[0]!;
      } else {
        const m = /^\/(shorts|embed|live|v)\/([A-Za-z0-9_-]{11})\/?$/.exec(
          url.pathname,
        );
        if (host.includes("nocookie") && m?.[1] !== "embed")
          throw new IngestionError("Unsupported embedded video URL");
        videoId = m?.[2] ?? "";
      }
    } else throw new IngestionError("Only YouTube video URLs are supported");
  }
  validateVideoId(videoId);
  return {
    videoId,
    url: `https://www.youtube.com/watch?v=${videoId}`,
    sourceId: `youtube:${videoId}`,
  };
}
async function requestText(
  url: string,
  options: NetworkOptions,
): Promise<string> {
  if (options.networkEnabled === false)
    throw new IngestionError(
      "YouTube networking is disabled; import a timestamped transcript or enable networking.",
      "NETWORK_DISABLED",
    );
  const timeoutMs = Math.min(Math.max(options.timeoutMs ?? 12000, 1), 60000);
  const maxBytes = Math.min(
    Math.max(options.maxBytes ?? 8 * 1024 * 1024, 1),
    16 * 1024 * 1024,
  );
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(
        new IngestionError(
          "YouTube request timed out; retry or import a transcript.",
          "TIMEOUT",
        ),
      );
    }, timeoutMs);
  });
  const work = async () => {
    const response = await (options.fetch ?? globalThis.fetch)(url, {
      signal: controller.signal,
      redirect: "error",
      headers: {
        Accept: "application/json,text/html;q=0.9",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });
    if (!response.ok)
      throw new IngestionError(
        `YouTube returned HTTP ${response.status}; retry or import a transcript.`,
        ["401", "403", "429"].includes(String(response.status))
          ? "USER_ACTION"
          : "HTTP_ERROR",
      );
    if (response.redirected)
      throw new IngestionError("YouTube redirect was blocked.", "USER_ACTION");
    const length = Number(response.headers.get("content-length"));
    if (Number.isFinite(length) && length > maxBytes) {
      await response.body?.cancel();
      throw new IngestionError(
        "YouTube response exceeds size limit.",
        "TOO_LARGE",
      );
    }
    if (!response.body) return "";
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let count = 0;
    let result = "";
    try {
      while (true) {
        const part = await reader.read();
        if (part.done) break;
        count += part.value.byteLength;
        if (count > maxBytes) {
          controller.abort();
          await reader.cancel();
          throw new IngestionError(
            "YouTube response exceeds size limit.",
            "TOO_LARGE",
          );
        }
        result += decoder.decode(part.value, { stream: true });
      }
      return result + decoder.decode();
    } finally {
      reader.releaseLock();
    }
  };
  try {
    return await Promise.race([work(), timeout]);
  } catch (e) {
    if (e instanceof IngestionError) throw e;
    throw new IngestionError(
      "YouTube request failed; retry or import a timestamped transcript.",
      "NETWORK_ERROR",
    );
  } finally {
    clearTimeout(timer);
    controller.abort();
  }
}
export async function fetchYouTubeMetadata(
  videoId: string,
  options: NetworkOptions = {},
): Promise<YouTubeMetadata> {
  validateVideoId(videoId);
  const url = `https://www.youtube.com/watch?v=${videoId}`;
  const metadata: YouTubeMetadata = {
    videoId,
    url,
    title: `YouTube ${videoId}`,
    channel: "",
  };
  try {
    const raw = await requestText(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`,
      { ...options, maxBytes: Math.min(options.maxBytes ?? 262144, 262144) },
    );
    let data: any;
    try {
      data = JSON.parse(raw);
    } catch {
      throw new IngestionError(
        "YouTube returned invalid metadata; retry later.",
        "INVALID_RESPONSE",
      );
    }
    if (
      typeof data.title !== "string" ||
      !data.title.trim() ||
      typeof data.author_name !== "string" ||
      data.title.length > 20000 ||
      data.author_name.length > 20000
    )
      throw new IngestionError(
        "YouTube metadata is incomplete; retry later.",
        "INVALID_RESPONSE",
      );
    return { ...metadata, title: data.title, channel: data.author_name };
  } catch (e) {
    return {
      ...metadata,
      error:
        e instanceof IngestionError
          ? e.message
          : "YouTube metadata is unavailable; retry later.",
    };
  }
}
function parseTimestamp(input: string): number {
  const text = input.replace(",", ".");
  if (!/^\d{1,}:\d{2}(?::\d{2})?(?:\.\d{1,3})?$/.test(text))
    throw new IngestionError("Invalid transcript timestamp");
  const values = text.split(":").map(Number);
  const seconds = values[values.length - 1]!;
  const minutes = values[values.length - 2]!;
  if (seconds >= 60 || (values.length === 3 && minutes >= 60))
    throw new IngestionError("Invalid transcript timestamp");
  const result =
    values.length === 3
      ? values[0]! * 3600 + minutes * 60 + seconds
      : minutes * 60 + seconds;
  if (!Number.isFinite(result) || result < 0 || result > 60 * 60 * 24 * 366)
    throw new IngestionError("Transcript timestamp is out of range");
  return Math.round(result * 1000) / 1000;
}
function decodeCaption(text: string): string {
  return text
    .replace(/<[^>]*>/g, "")
    .replace(
      /&(?:amp|lt|gt|quot|apos|nbsp);|&#(?:x[0-9a-f]+|\d+);/gi,
      (entity) => {
        const named: Record<string, string> = {
          "&amp;": "&",
          "&lt;": "<",
          "&gt;": ">",
          "&quot;": '"',
          "&apos;": "'",
          "&nbsp;": " ",
        };
        if (named[entity.toLowerCase()]) return named[entity.toLowerCase()]!;
        const n =
          entity[2]!.toLowerCase() === "x"
            ? parseInt(entity.slice(3, -1), 16)
            : parseInt(entity.slice(2, -1), 10);
        return n > 0 && n <= 0x10ffff && !(n >= 0xd800 && n <= 0xdfff)
          ? String.fromCodePoint(n)
          : "\uFFFD";
      },
    );
}
function validateSegments(segments: TranscriptSegment[]) {
  if (!segments.length)
    throw new IngestionError("No timestamped transcript passages were found");
  if (segments.length > 20000)
    throw new IngestionError("Transcript has too many segments");
  let previous = -1;
  for (const segment of segments) {
    if (
      !Number.isFinite(segment.start) ||
      !Number.isFinite(segment.end) ||
      segment.start < 0 ||
      segment.end < segment.start ||
      segment.start < previous ||
      !segment.text.trim()
    )
      throw new IngestionError(
        "Transcript contains invalid or out-of-order cues",
      );
    if (segment.text.includes("\0"))
      throw new IngestionError("Transcript contains null characters");
    previous = segment.start;
  }
}
export function parseUserTranscript(
  text: string,
  sourceId: string,
  language = "en",
): Transcript {
  if (typeof sourceId !== "string" || !sourceId.startsWith("youtube:"))
    throw new IngestionError("Invalid transcript source ID");
  validateVideoId(sourceId.slice(8));
  validateLanguage(language);
  if (
    typeof text !== "string" ||
    Buffer.byteLength(text) > MAX_IMPORT_BYTES ||
    text.includes("\0")
  )
    throw new IngestionError("Transcript is invalid or exceeds 2 MiB");
  const raw = text
    .replace(/^\uFEFF/, "")
    .replace(/\r\n?/g, "\n")
    .trim();
  const segments: TranscriptSegment[] = [];
  if (
    raw.startsWith("WEBVTT") ||
    /^\s*(?:\d+\n)?\d{1,}:\d{2}(?::\d{2})?[.,]\d{1,3}\s+-->/.test(raw)
  ) {
    for (const block of raw.split(/\n[ \t]*\n/)) {
      if (
        /^(?:WEBVTT(?:\s|$)|NOTE(?:\s|$)|STYLE(?:\s|$)|REGION(?:\s|$))/.test(
          block,
        )
      )
        continue;
      const lines = block.split("\n");
      const index = lines.findIndex((l) => l.includes("-->"));
      if (index < 0 || index > 1)
        throw new IngestionError("Invalid subtitle cue");
      const match = /^(\S+)\s+-->\s+(\S+)(?:\s+.*)?$/.exec(lines[index]!);
      if (!match) throw new IngestionError("Invalid subtitle timestamps");
      const body = decodeCaption(lines.slice(index + 1).join("\n")).trim();
      if (!body) throw new IngestionError("Subtitle cue is empty");
      segments.push({
        start: parseTimestamp(match[1]!),
        end: parseTimestamp(match[2]!),
        text: body,
      });
    }
  } else {
    const explicitEnds = new Set<number>();
    for (const line of raw.split("\n")) {
      const match =
        /^\s*(?:\[([^\]]+)\]|((?:\d+:){1,2}\d{2}(?:\.\d{1,3})?))(?:\s*(?:-->|–|-)\s*\[?((?:\d+:){1,2}\d{2}(?:\.\d{1,3})?)\]?)?(?:\s+|$)(.*)$/.exec(
          line,
        );
      if (match) {
        const start = parseTimestamp(match[1] ?? match[2]!);
        const end = match[3] ? parseTimestamp(match[3]) : start;
        if (match[3]) explicitEnds.add(segments.length);
        segments.push({ start, end, text: match[4] ?? "" });
      } else {
        if (/^\s*(?:\[?\d+:|\d+\s*-->)/.test(line))
          throw new IngestionError("Invalid transcript timestamp");
        if (!segments.length && line.trim())
          throw new IngestionError(
            "Each transcript must begin with a timestamp",
          );
        if (segments.length) segments[segments.length - 1]!.text += `\n${line}`;
      }
    }
    segments.forEach((segment, i) => {
      segment.text = segment.text.trim();
      if (!explicitEnds.has(i) && segments[i + 1])
        segment.end = segments[i + 1]!.start;
    });
  }
  validateSegments(segments);
  return {
    sourceId,
    language,
    provider: "user-import",
    generated: null,
    status: "available",
    segments,
  };
}
/** Extract a JSON object without evaluating untrusted watch-page JavaScript. */
export function extractPlayerResponse(html: string): any | null {
  const markers =
    /(?:var\s+)?ytInitialPlayerResponse\s*=\s*|window\["ytInitialPlayerResponse"\]\s*=\s*/g;
  for (const match of html.matchAll(markers)) {
    const start = match.index! + match[0].length;
    if (html[start] !== "{") continue;
    let depth = 0;
    let quoted = false;
    let escape = false;
    for (let i = start; i < html.length; i++) {
      const c = html[i];
      if (quoted) {
        if (escape) escape = false;
        else if (c === "\\") escape = true;
        else if (c === '"') quoted = false;
      } else if (c === '"') quoted = true;
      else if (c === "{") depth++;
      else if (c === "}" && --depth === 0) {
        try {
          return JSON.parse(html.slice(start, i + 1));
        } catch {
          break;
        }
      }
    }
  }
  return null;
}
export class YouTubeCaptionProvider implements TranscriptProvider {
  readonly name = "youtube-captions";
  constructor(private readonly options: NetworkOptions = {}) {}
  async fetch(videoId: string, language = "en"): Promise<Transcript> {
    validateVideoId(videoId);
    validateLanguage(language);
    const base: Transcript = {
      sourceId: `youtube:${videoId}`,
      language,
      provider: this.name,
      generated: null,
      status: "unavailable",
      segments: [],
    };
    const failure = (status: TranscriptStatus, error: string): Transcript => ({
      ...base,
      status,
      error,
    });
    try {
      const html = await requestText(
        `https://www.youtube.com/watch?v=${videoId}&hl=en`,
        this.options,
      );
      const player = extractPlayerResponse(html);
      if (!player)
        return failure(
          "requires_user_action",
          "YouTube did not expose caption tracks; retry or import a timestamped transcript.",
        );
      if (
        player.playabilityStatus?.status &&
        player.playabilityStatus.status !== "OK"
      )
        return failure(
          "requires_user_action",
          "Video playback is restricted; import a transcript you can access.",
        );
      const tracks =
        player.captions?.playerCaptionsTracklistRenderer?.captionTracks;
      if (!Array.isArray(tracks) || !tracks.length)
        return failure(
          "unavailable",
          "This video has no exposed caption tracks; import a timestamped transcript.",
        );
      const valid = tracks.filter(
        (t: any) =>
          typeof t.languageCode === "string" && typeof t.baseUrl === "string",
      );
      const track =
        valid
          .filter(
            (t: any) => t.languageCode.toLowerCase() === language.toLowerCase(),
          )
          .sort(
            (a: any, b: any) =>
              Number(a.kind === "asr") - Number(b.kind === "asr"),
          )[0] ??
        valid.find(
          (t: any) => t.languageCode.split("-")[0] === language.split("-")[0],
        ) ??
        valid.find((t: any) => t.kind !== "asr") ??
        valid[0];
      if (!track)
        return failure(
          "failed",
          "YouTube caption metadata was invalid; retry or import a transcript.",
        );
      validateLanguage(track.languageCode);
      const url = new URL(track.baseUrl);
      if (
        url.protocol !== "https:" ||
        !["www.youtube.com", "youtube.com"].includes(url.hostname) ||
        url.port ||
        url.username ||
        url.password ||
        url.pathname !== "/api/timedtext" ||
        url.searchParams.get("v") !== videoId ||
        url.searchParams.getAll("v").length !== 1
      )
        return failure("failed", "YouTube returned an unsafe caption URL.");
      url.searchParams.set("fmt", "json3");
      const raw = await requestText(url.toString(), {
        ...this.options,
        maxBytes: Math.min(
          this.options.maxBytes ?? MAX_IMPORT_BYTES,
          MAX_IMPORT_BYTES,
        ),
      });
      if (!raw.trim())
        return failure(
          "requires_user_action",
          "YouTube returned empty captions, possibly requiring browser verification; import a timestamped transcript.",
        );
      let caption: any;
      try {
        caption = JSON.parse(raw);
      } catch {
        return failure(
          "failed",
          "YouTube returned malformed captions; retry or import a transcript.",
        );
      }
      if (!Array.isArray(caption.events))
        return failure(
          "failed",
          "YouTube returned an unsupported caption format.",
        );
      const segments: TranscriptSegment[] = [];
      for (const event of caption.events) {
        if (!Array.isArray(event.segs)) continue;
        if (event.segs.some((s: any) => !s || typeof s.utf8 !== "string"))
          throw new IngestionError(
            "Malformed caption text",
            "INVALID_RESPONSE",
          );
        const text = event.segs
          .map((s: any) => s.utf8)
          .join("")
          .trim();
        if (!text) continue;
        if (
          typeof event.tStartMs !== "number" ||
          !Number.isFinite(event.tStartMs) ||
          (event.dDurationMs !== undefined &&
            (typeof event.dDurationMs !== "number" ||
              !Number.isFinite(event.dDurationMs) ||
              event.dDurationMs < 0))
        )
          throw new IngestionError(
            "Malformed caption timestamps",
            "INVALID_RESPONSE",
          );
        segments.push({
          start: event.tStartMs / 1000,
          end: (event.tStartMs + (event.dDurationMs ?? 0)) / 1000,
          text,
        });
      }
      if (!segments.length)
        return failure(
          "unavailable",
          "No caption text was returned; import a timestamped transcript.",
        );
      validateSegments(segments);
      return {
        ...base,
        language: track.languageCode,
        generated: track.kind === "asr",
        status: "available",
        segments,
      };
    } catch (e) {
      return failure(
        e instanceof IngestionError &&
          ["USER_ACTION", "NETWORK_DISABLED"].includes(e.code)
          ? "requires_user_action"
          : "failed",
        e instanceof IngestionError
          ? e.message
          : "Caption retrieval failed; retry or import a timestamped transcript.",
      );
    }
  }
}
