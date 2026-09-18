import { describe, expect, it } from "bun:test";

import { parseUserAgent } from "../../../../packages/design-system/src/lib/parse-user-agent";

describe("parseUserAgent", () => {
  describe("null / empty input", () => {
    it("returns Unknown for null input", () => {
      const result = parseUserAgent(null);
      expect(result).toEqual({ browser: "Unknown", os: "Unknown", device: "unknown" });
    });

    it("returns Unknown browser for empty string", () => {
      const result = parseUserAgent("");
      expect(result.browser).toBe("Unknown");
    });
  });

  describe("browser detection", () => {
    it("detects Chrome", () => {
      const ua =
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
      expect(parseUserAgent(ua).browser).toBe("Chrome 120");
    });

    it("detects Firefox", () => {
      const ua =
        "Mozilla/5.0 (X11; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0";
      expect(parseUserAgent(ua).browser).toBe("Firefox 121");
    });

    it("detects Safari (not Chrome)", () => {
      const ua =
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15";
      expect(parseUserAgent(ua).browser).toBe("Safari 17");
    });

    it("detects Edge (not Chrome)", () => {
      const ua =
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0";
      expect(parseUserAgent(ua).browser).toBe("Edge 120");
    });

    it("detects Opera (OPR format)", () => {
      const ua =
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 OPR/106.0.0.0";
      expect(parseUserAgent(ua).browser).toBe("Opera 106");
    });

    it("detects Brave", () => {
      const ua =
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Brave";
      expect(parseUserAgent(ua).browser).toBe("Brave");
    });

    it("detects Vivaldi", () => {
      const ua =
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Vivaldi/6.5.3206.57";
      expect(parseUserAgent(ua).browser).toBe("Vivaldi 6");
    });

    it("returns 'Unknown' for unrecognized UA", () => {
      expect(parseUserAgent("SomeBot/1.0").browser).toBe("Unknown");
    });
  });

  describe("OS detection", () => {
    it("detects Windows", () => {
      const ua =
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0";
      expect(parseUserAgent(ua).os).toBe("Windows");
    });

    it("detects macOS", () => {
      const ua =
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.2 Safari/605.1.15";
      expect(parseUserAgent(ua).os).toBe("macOS");
    });

    it("detects iOS from iPhone UA", () => {
      const ua =
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 Version/17.2 Mobile/15E148 Safari/604.1";
      expect(parseUserAgent(ua).os).toBe("iOS");
    });

    it("detects iOS from iPad UA", () => {
      const ua =
        "Mozilla/5.0 (iPad; CPU OS 17_2 like Mac OS X) AppleWebKit/605.1.15 Version/17.2 Mobile/15E148 Safari/604.1";
      expect(parseUserAgent(ua).os).toBe("iOS");
    });

    it("detects Android", () => {
      const ua =
        "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36";
      expect(parseUserAgent(ua).os).toBe("Android");
    });

    it("detects Linux", () => {
      const ua =
        "Mozilla/5.0 (X11; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0";
      expect(parseUserAgent(ua).os).toBe("Linux");
    });

    it("detects ChromeOS", () => {
      const ua =
        "Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36";
      expect(parseUserAgent(ua).os).toBe("ChromeOS");
    });

    it("returns 'Unknown' for unrecognized UA", () => {
      expect(parseUserAgent("SomeBot/1.0").os).toBe("Unknown");
    });
  });

  describe("device detection", () => {
    it("detects desktop from Chrome on Windows", () => {
      const ua =
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0";
      expect(parseUserAgent(ua).device).toBe("desktop");
    });

    it("detects desktop from macOS Safari", () => {
      const ua =
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.2 Safari/605.1.15";
      expect(parseUserAgent(ua).device).toBe("desktop");
    });

    it("detects mobile from iPhone", () => {
      const ua =
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 Version/17.2 Mobile/15E148 Safari/604.1";
      expect(parseUserAgent(ua).device).toBe("mobile");
    });

    it("detects tablet from iPad", () => {
      const ua =
        "Mozilla/5.0 (iPad; CPU OS 17_2 like Mac OS X) AppleWebKit/605.1.15 Version/17.2 Mobile/15E148 Safari/604.1";
      expect(parseUserAgent(ua).device).toBe("tablet");
    });

    it("detects mobile from Android phone", () => {
      const ua =
        "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36";
      expect(parseUserAgent(ua).device).toBe("mobile");
    });

    it("detects tablet from Android tablet (no Mobile keyword)", () => {
      const ua =
        "Mozilla/5.0 (Linux; Android 13; SM-X200) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36";
      expect(parseUserAgent(ua).device).toBe("tablet");
    });

    it("detects mobile from iPod", () => {
      const ua =
        "Mozilla/5.0 (iPod touch; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 Version/15.0 Mobile/15E148 Safari/604.1";
      expect(parseUserAgent(ua).device).toBe("mobile");
    });

    it("returns unknown for unrecognized UA without common platform tokens", () => {
      expect(parseUserAgent("SomeBot/1.0").device).toBe("unknown");
    });
  });

  describe("combined parsing", () => {
    it("correctly identifies Chrome on Windows desktop", () => {
      const ua =
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
      const result = parseUserAgent(ua);
      expect(result).toEqual({
        browser: "Chrome 120",
        os: "Windows",
        device: "desktop",
      });
    });

    it("correctly identifies Safari on iPhone", () => {
      const ua =
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1";
      const result = parseUserAgent(ua);
      expect(result).toEqual({
        browser: "Safari 17",
        os: "iOS",
        device: "mobile",
      });
    });

    it("correctly identifies Firefox on Linux desktop", () => {
      const ua =
        "Mozilla/5.0 (X11; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0";
      const result = parseUserAgent(ua);
      expect(result).toEqual({
        browser: "Firefox 121",
        os: "Linux",
        device: "desktop",
      });
    });

    it("correctly identifies Edge on Windows desktop", () => {
      const ua =
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.2210.91";
      const result = parseUserAgent(ua);
      expect(result).toEqual({
        browser: "Edge 120",
        os: "Windows",
        device: "desktop",
      });
    });

    it("correctly identifies Chrome on Android mobile", () => {
      const ua =
        "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.144 Mobile Safari/537.36";
      const result = parseUserAgent(ua);
      expect(result).toEqual({
        browser: "Chrome 120",
        os: "Android",
        device: "mobile",
      });
    });
  });
});
