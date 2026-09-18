// ---------------------------------------------------------------------------
// Lightweight user agent parser — no external dependencies
// Extracts browser, OS, and device type from user agent strings.
// ---------------------------------------------------------------------------

export interface DeviceInfo {
  browser: string;
  os: string;
  device: "desktop" | "mobile" | "tablet" | "unknown";
}

/**
 * Parse a user agent string into structured device info.
 * Uses simple regex matching — intentionally lightweight.
 */
export function parseUserAgent(ua: string | null | undefined): DeviceInfo {
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
    return `Edge ${majorVersion(match)}`;
  }
  if (/OPR\//i.test(ua) || /Opera/i.test(ua)) {
    const match = ua.match(/(?:OPR|Opera)\/([\d.]+)/);
    return `Opera ${majorVersion(match)}`;
  }
  if (/Brave/i.test(ua)) {
    return "Brave";
  }
  if (/Vivaldi\//i.test(ua)) {
    const match = ua.match(/Vivaldi\/([\d.]+)/);
    return `Vivaldi ${majorVersion(match)}`;
  }
  if (/Chrome\//i.test(ua) && !/Chromium/i.test(ua)) {
    const match = ua.match(/Chrome\/([\d.]+)/);
    return `Chrome ${majorVersion(match)}`;
  }
  if (/Safari\//i.test(ua) && !/Chrome/i.test(ua)) {
    const match = ua.match(/Version\/([\d.]+)/);
    return `Safari ${majorVersion(match)}`;
  }
  if (/Firefox\//i.test(ua)) {
    const match = ua.match(/Firefox\/([\d.]+)/);
    return `Firefox ${majorVersion(match)}`;
  }
  return "Unknown";
}

function detectOS(ua: string): string {
  if (/iPhone|iPad|iPod/i.test(ua)) {
    const match = ua.match(/OS ([\d_]+)/);
    const version = match?.[1]?.replace(/_/g, ".") ?? "";
    return `iOS ${majorMinor(version)}`;
  }
  if (/Mac OS X/i.test(ua)) {
    const match = ua.match(/Mac OS X ([\d_.]+)/);
    const version = match?.[1]?.replace(/_/g, ".") ?? "";
    return `macOS ${majorMinor(version)}`;
  }
  if (/Android/i.test(ua)) {
    const match = ua.match(/Android ([\d.]+)/);
    return `Android ${majorMinor(match?.[1] ?? "")}`;
  }
  if (/Windows/i.test(ua)) {
    const match = ua.match(/Windows NT ([\d.]+)/);
    const ntMap: Record<string, string> = {
      "10.0": "10+",
      "6.3": "8.1",
      "6.2": "8",
      "6.1": "7",
    };
    const version = match?.[1] ?? "";
    return `Windows ${ntMap[version] ?? version}`;
  }
  if (/Linux/i.test(ua)) {
    if (/Ubuntu/i.test(ua)) return "Ubuntu Linux";
    if (/Fedora/i.test(ua)) return "Fedora Linux";
    return "Linux";
  }
  if (/CrOS/i.test(ua)) return "ChromeOS";
  return "Unknown";
}

function detectDevice(ua: string): "desktop" | "mobile" | "tablet" | "unknown" {
  if (/iPad/i.test(ua)) return "tablet";
  if (/Tablet|PlayBook|Silk/i.test(ua)) return "tablet";
  if (/iPhone|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua) || (/Android/i.test(ua) && /Mobile/i.test(ua))) {
    return "mobile";
  }
  if (/Android/i.test(ua)) return "tablet"; // Android without "Mobile" = tablet
  if (/Windows|Macintosh|Mac OS X|Linux|CrOS/i.test(ua)) return "desktop";
  return "unknown";
}

function majorVersion(match: RegExpMatchArray | null): string {
  if (!match?.[1]) return "";
  return match[1].split(".")[0];
}

function majorMinor(version: string): string {
  if (!version) return "";
  const parts = version.split(".");
  return parts.slice(0, 2).join(".");
}
