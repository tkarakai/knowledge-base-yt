import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { Transcript } from "@repo/kb-shared";
import { parseYouTubeJson3, YouTubeCaptionProvider } from "@repo/ingestion";

const python = fileURLToPath(
  new URL("../../../.kb-local/transcripts/bin/python", import.meta.url),
);
const helper = fileURLToPath(
  new URL(
    "../../../packages/ingestion/src/ytdlp-transcript.py",
    import.meta.url,
  ),
);
export interface CaptionProcessResult {
  stdout: string;
  stderr: string;
  timedOut?: boolean;
}
export function runCaptionProcess(
  executable: string,
  args: string[],
): Promise<CaptionProcessResult> {
  return new Promise((resolve) => {
    execFile(
      executable,
      args,
      {
        timeout: 90_000,
        maxBuffer: 4 * 1024 * 1024,
        encoding: "utf8",
        killSignal: "SIGKILL",
      },
      (error, stdout, stderr) =>
        resolve({
          stdout,
          stderr: stderr || error?.message || "",
          timedOut: error?.killed,
        }),
    );
  });
}
export class CaptionProvider {
  constructor(
    private options: {
      networkEnabled: boolean;
      python?: string;
      browser?: string;
      run?: typeof runCaptionProcess;
      trace?: (type: string, data: unknown) => Promise<void>;
    },
  ) {}
  async fetch(videoId: string, language = "en"): Promise<Transcript> {
    if (
      !/^[A-Za-z0-9_-]{11}$/.test(videoId) ||
      !/^[A-Za-z]{2,8}(?:-[A-Za-z0-9]{1,8})*$/.test(language)
    )
      throw new Error("Invalid caption request");
    const base: Transcript = {
      sourceId: `youtube:${videoId}`,
      language,
      provider: "yt-dlp",
      generated: null,
      status: "failed",
      segments: [],
    };
    if (!this.options.networkEnabled)
      return {
        ...base,
        status: "requires_user_action",
        error:
          "Enable YouTube networking in Settings before fetching captions.",
      };
    const executable =
      this.options.python ?? process.env.KB_TRANSCRIPT_PYTHON ?? python;
    if (!existsSync(executable) && !this.options.run) {
      const fallback = await new YouTubeCaptionProvider().fetch(
        videoId,
        language,
      );
      if (fallback.status === "available") return fallback;
      return {
        ...fallback,
        error: `${fallback.error} Install the maintained extractor with bun run setup:transcripts, then retry captions.`,
      };
    }
    const browser =
      this.options.browser ?? process.env.KB_YTDLP_COOKIES_FROM_BROWSER ?? "";
    await this.options.trace?.("caption_request", {
      provider: "yt-dlp",
      videoId,
      language,
      browser: browser || null,
    });
    const result = await (this.options.run ?? runCaptionProcess)(executable, [
      helper,
      videoId,
      language,
      browser,
    ]);
    await this.options.trace?.("caption_diagnostics", {
      stderr: result.stderr,
      timedOut: result.timedOut ?? false,
    });
    if (result.timedOut)
      return {
        ...base,
        error:
          "Caption extraction timed out after 90 seconds. Check YouTube access and retry.",
      };
    try {
      const value = JSON.parse(result.stdout);
      if (value.status !== "available") {
        const error =
          typeof value.error === "string"
            ? value.error
            : "Caption extraction failed";
        const needsBrowser =
          /sign in|login|bot|verification|empty captions|PO token|429|403/i.test(
            error,
          );
        return {
          ...base,
          status:
            value.status === "unavailable"
              ? "unavailable"
              : needsBrowser
                ? "requires_user_action"
                : "failed",
          error: needsBrowser
            ? `${error}. Try your browser session (KB_YTDLP_COOKIES_FROM_BROWSER=chrome) or consult the transcript troubleshooting guide.`
            : error,
        };
      }
      if (
        typeof value.language !== "string" ||
        !/^[A-Za-z]{2,8}(?:-[A-Za-z0-9]{1,8})*$/.test(value.language) ||
        typeof value.generated !== "boolean"
      )
        throw new Error("Invalid extractor metadata");
      const segments = parseYouTubeJson3(JSON.stringify(value.captions));
      await this.options.trace?.("caption_result", {
        language: value.language,
        generated: value.generated,
        segments: segments.length,
      });
      return {
        ...base,
        language: value.language,
        generated: value.generated,
        status: "available",
        segments,
      };
    } catch (error) {
      return {
        ...base,
        error: `Caption extractor returned invalid data: ${error instanceof Error ? error.message : "unknown error"}. See the activity trace; rerun bun run setup:transcripts if dependencies are missing.`,
      };
    }
  }
}
