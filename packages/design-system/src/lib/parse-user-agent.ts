/** Device type extracted from a user-agent string. */
export type DeviceType = "desktop" | "mobile" | "tablet" | "unknown";

/** Parsed information from a user-agent string. */
export interface ParsedUserAgent {
  browser: string;
  os: string;
  device: DeviceType;
}

/**
 * Parse a user-agent string into structured device information.
 * Uses simple regex matching — intentionally lightweight, no dependencies.
 */
export function parseUserAgent(ua: string | null | undefined): ParsedUserAgent {
  if (!ua) {
    return { browser: "Unknown", os: "Unknown", device: "unknown" };
  }
  return {
    browser: detectBrowser(ua),
    os: detectOS(ua),
    device: detectDevice(ua),
  };
}

function detectBrowser(ua: string): string {
  // Order matters — check more specific patterns first
  if (/Edg\//i.test(ua)) {
    const match = ua.match(/Edg\/([\d.]+)/);
    return `Edge ${majorVersion(match)}`.trim();
  }
  if (/OPR\//i.test(ua) || /Opera/i.test(ua)) {
    const match = ua.match(/(?:OPR|Opera)\/([\d.]+)/);
    return `Opera ${majorVersion(match)}`.trim();
  }
  if (/Brave/i.test(ua)) return "Brave";
  if (/Vivaldi\//i.test(ua)) {
    const match = ua.match(/Vivaldi\/([\d.]+)/);
    return `Vivaldi ${majorVersion(match)}`.trim();
  }
  if (/Chrome\//i.test(ua) && !/Chromium/i.test(ua)) {
    const match = ua.match(/Chrome\/([\d.]+)/);
    return `Chrome ${majorVersion(match)}`.trim();
  }
  if (/Safari\//i.test(ua) && !/Chrome/i.test(ua)) {
    const match = ua.match(/Version\/([\d.]+)/);
    return `Safari ${majorVersion(match)}`.trim();
  }
  if (/Firefox\//i.test(ua)) {
    const match = ua.match(/Firefox\/([\d.]+)/);
    return `Firefox ${majorVersion(match)}`.trim();
  }
  return "Unknown";
}

function detectOS(ua: string): string {
  if (/iPhone|iPad|iPod/i.test(ua)) return "iOS";
  if (/Mac OS X/i.test(ua)) return "macOS";
  if (/Android/i.test(ua)) return "Android";
  if (/Windows/i.test(ua)) return "Windows";
  if (/Linux/i.test(ua)) return "Linux";
  if (/CrOS/i.test(ua)) return "ChromeOS";
  return "Unknown";
}

function detectDevice(ua: string): DeviceType {
  if (/iPad/i.test(ua)) return "tablet";
  if (/Tablet|PlayBook|Silk/i.test(ua)) return "tablet";
  if (/iPhone|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua) || (/Android/i.test(ua) && /Mobile/i.test(ua))) {
    return "mobile";
  }
  if (/Android/i.test(ua)) return "tablet";
  if (/Windows|Macintosh|Mac OS X|Linux|CrOS/i.test(ua)) return "desktop";
  return "unknown";
}

function majorVersion(match: RegExpMatchArray | null): string {
  if (!match?.[1]) return "";
  return match[1].split(".")[0];
}
