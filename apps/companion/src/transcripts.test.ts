import { expect, test } from "bun:test";
import { CaptionProvider } from "./transcripts";

test("yt-dlp adapter preserves timestamped auto captions and reports provider diagnostics", async () => {
  const events: string[] = [];
  const provider = new CaptionProvider({
    networkEnabled: true,
    run: async (_executable, args) => {
      expect(args.slice(1)).toEqual(["oPZLPUtmROo", "en", ""]);
      return {
        stdout: JSON.stringify({
          status: "available",
          language: "en",
          generated: true,
          captions: {
            events: [
              {
                tStartMs: 1250,
                dDurationMs: 2500,
                segs: [{ utf8: "Hello " }, { utf8: "world" }],
              },
            ],
          },
        }),
        stderr: "provider warning",
      };
    },
    trace: async (type) => {
      events.push(type);
    },
  });
  const result = await provider.fetch("oPZLPUtmROo");
  expect(result).toMatchObject({
    provider: "yt-dlp",
    status: "available",
    generated: true,
    segments: [{ start: 1.25, end: 3.75, text: "Hello world" }],
  });
  expect(events).toContain("caption_diagnostics");
});

test("caption adapter distinguishes access failures, timeout and corrupt captions", async () => {
  for (const [result, expected] of [
    [
      {
        stdout: JSON.stringify({
          status: "failed",
          error: "Sign in to confirm you are not a bot",
        }),
        stderr: "",
      },
      "requires_user_action",
    ],
    [{ stdout: "", stderr: "", timedOut: true }, "failed"],
    [{ stdout: "not json", stderr: "dependency missing" }, "failed"],
    [
      {
        stdout: JSON.stringify({ status: "unavailable", error: "No captions" }),
        stderr: "",
      },
      "unavailable",
    ],
  ] as const) {
    const provider = new CaptionProvider({
      networkEnabled: true,
      run: async () => result,
    });
    expect((await provider.fetch("oPZLPUtmROo")).status).toBe(expected);
  }
});

test("disabled YouTube networking and invalid IDs never launch a process", async () => {
  let called = false;
  const provider = new CaptionProvider({
    networkEnabled: false,
    run: async () => {
      called = true;
      return { stdout: "", stderr: "" };
    },
  });
  expect((await provider.fetch("oPZLPUtmROo")).status).toBe(
    "requires_user_action",
  );
  await expect(provider.fetch("../bad")).rejects.toThrow();
  expect(called).toBe(false);
});
