import { describe, expect, it } from "bun:test";

import {
  formatBytes,
  formatDateTime,
  getDeadlineUrgency,
} from "../../src/lib/format";

describe("formatBytes", () => {
  it("formats bytes into human readable output", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(1024)).toBe("1.0 KB");
    expect(formatBytes(1536)).toBe("1.5 KB");
  });

  it("handles invalid values", () => {
    expect(formatBytes(-1)).toBe("0 B");
    expect(formatBytes(Number.NaN)).toBe("0 B");
  });
});

describe("formatDateTime", () => {
  it("formats a numeric timestamp", () => {
    const output = formatDateTime(1700000000000);
    expect(output.length).toBeGreaterThan(0);
  });
});

describe("getDeadlineUrgency", () => {
  it("returns 'done' when status is done regardless of deadline", () => {
    const pastDeadline = Date.now() - 1000 * 60 * 60;
    expect(getDeadlineUrgency(pastDeadline, "done")).toBe("done");

    const futureDeadline = Date.now() + 1000 * 60 * 60 * 48;
    expect(getDeadlineUrgency(futureDeadline, "done")).toBe("done");
  });

  it("returns 'overdue' when deadline is in the past and not done", () => {
    const pastDeadline = Date.now() - 1000 * 60 * 60; // 1 hour ago
    expect(getDeadlineUrgency(pastDeadline, "todo")).toBe("overdue");
    expect(getDeadlineUrgency(pastDeadline, "in_progress")).toBe("overdue");
  });

  it("returns 'urgent' when deadline is within 24 hours and not done", () => {
    const soonDeadline = Date.now() + 1000 * 60 * 60 * 12; // 12 hours from now
    expect(getDeadlineUrgency(soonDeadline, "todo")).toBe("urgent");
    expect(getDeadlineUrgency(soonDeadline, "in_progress")).toBe("urgent");
  });

  it("returns 'normal' when deadline is more than 24 hours away", () => {
    const farDeadline = Date.now() + 1000 * 60 * 60 * 48; // 48 hours from now
    expect(getDeadlineUrgency(farDeadline, "todo")).toBe("normal");
    expect(getDeadlineUrgency(farDeadline, "in_progress")).toBe("normal");
  });
});
