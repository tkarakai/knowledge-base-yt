import { describe, expect, test } from "vitest";

import { parseUserAgent } from "./parseUserAgent";

describe("parseUserAgent (backend)", () => {
  describe("null / undefined / empty", () => {
    test("returns Unknown for null", () => {
      expect(parseUserAgent(null)).toEqual({
        browser: "Unknown",
        os: "Unknown",
        device: "unknown",
      });
    });

    test("returns Unknown for undefined", () => {
      expect(parseUserAgent(undefined)).toEqual({
        browser: "Unknown",
        os: "Unknown",
        device: "unknown",
      });
    });

    test("returns Unknown browser for empty string", () => {
      const result = parseUserAgent("");
      expect(result.browser).toBe("Unknown");
    });
  });

  describe("browser detection", () => {
    test("detects Chrome", () => {
      const ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
      expect(parseUserAgent(ua).browser).toBe("Chrome 120");
    });

    test("detects Firefox", () => {
      const ua = "Mozilla/5.0 (X11; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0";
      expect(parseUserAgent(ua).browser).toBe("Firefox 121");
    });

    test("detects Safari", () => {
      const ua = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15";
      expect(parseUserAgent(ua).browser).toBe("Safari 17");
    });

    test("detects Edge (not Chrome)", () => {
      const ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.2210.91";
      expect(parseUserAgent(ua).browser).toBe("Edge 120");
    });

    test("detects Opera (OPR format)", () => {
      const ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 OPR/106.0.0.0";
      expect(parseUserAgent(ua).browser).toBe("Opera 106");
    });

    test("detects Brave", () => {
      const ua = "Mozilla/5.0 (Windows NT 10.0) Chrome/120.0.0.0 Brave Safari/537.36";
      expect(parseUserAgent(ua).browser).toBe("Brave");
    });

    test("detects Vivaldi", () => {
      const ua = "Mozilla/5.0 (Windows NT 10.0) Chrome/120.0.0.0 Vivaldi/6.5.3206.57";
      expect(parseUserAgent(ua).browser).toBe("Vivaldi 6");
    });
  });

  describe("OS detection", () => {
    test("detects Windows 10+", () => {
      const ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0";
      expect(parseUserAgent(ua).os).toBe("Windows 10+");
    });

    test("detects macOS with version", () => {
      const ua = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15";
      expect(parseUserAgent(ua).os).toBe("macOS 10.15");
    });

    test("detects iOS from iPhone", () => {
      const ua = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1";
      expect(parseUserAgent(ua).os).toBe("iOS 17.2");
    });

    test("detects Android with version", () => {
      const ua = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36";
      expect(parseUserAgent(ua).os).toBe("Android 14");
    });

    test("detects Linux", () => {
      const ua = "Mozilla/5.0 (X11; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0";
      expect(parseUserAgent(ua).os).toBe("Linux");
    });

    test("detects ChromeOS", () => {
      const ua = "Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36";
      expect(parseUserAgent(ua).os).toBe("ChromeOS");
    });
  });

  describe("device detection", () => {
    test("detects desktop from Windows Chrome", () => {
      const ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0";
      expect(parseUserAgent(ua).device).toBe("desktop");
    });

    test("detects desktop from macOS Safari", () => {
      const ua = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15";
      expect(parseUserAgent(ua).device).toBe("desktop");
    });

    test("detects mobile from iPhone", () => {
      const ua = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1";
      expect(parseUserAgent(ua).device).toBe("mobile");
    });

    test("detects tablet from iPad", () => {
      const ua = "Mozilla/5.0 (iPad; CPU OS 17_2 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1";
      expect(parseUserAgent(ua).device).toBe("tablet");
    });

    test("detects mobile from Android phone", () => {
      const ua = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36";
      expect(parseUserAgent(ua).device).toBe("mobile");
    });

    test("detects tablet from Android tablet (no Mobile keyword)", () => {
      const ua = "Mozilla/5.0 (Linux; Android 13; SM-X200) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36";
      expect(parseUserAgent(ua).device).toBe("tablet");
    });
  });

  describe("combined parsing", () => {
    test("Chrome on Windows desktop", () => {
      const ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
      const result = parseUserAgent(ua);
      expect(result.browser).toBe("Chrome 120");
      expect(result.os).toBe("Windows 10+");
      expect(result.device).toBe("desktop");
    });

    test("Safari on iPhone mobile", () => {
      const ua = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1";
      const result = parseUserAgent(ua);
      expect(result.browser).toBe("Safari 17");
      expect(result.os).toBe("iOS 17.2");
      expect(result.device).toBe("mobile");
    });

    test("Firefox on Linux desktop", () => {
      const ua = "Mozilla/5.0 (X11; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0";
      const result = parseUserAgent(ua);
      expect(result.browser).toBe("Firefox 121");
      expect(result.os).toBe("Linux");
      expect(result.device).toBe("desktop");
    });
  });
});
