import { describe, expect, test } from "bun:test";
import { historyDay, twelveMonthsAgo } from "./history";
describe("12-month calendar window and YouTube section dates", () => {
  test("uses calendar months, clamps leap days, and includes the cutoff day", () => {
    expect(twelveMonthsAgo("2026-09-16")).toBe("2025-09-16");
    expect(twelveMonthsAgo("2024-02-29")).toBe("2023-02-28");
    expect(twelveMonthsAgo("2025-03-01")).toBe("2024-03-01");
  });
  test("relative dates, weekdays, explicit years, and inferred year rollover", () => {
    expect(historyDay("Today", "2026-01-02")).toBe("2026-01-02");
    expect(historyDay("Yesterday", "2026-01-01")).toBe("2025-12-31");
    expect(historyDay("Monday", "2026-09-16")).toBe("2026-09-14");
    expect(historyDay("Dec 31", "2026-01-02")).toBe("2025-12-31");
    expect(historyDay("September 16, 2025", "2026-09-16")).toBe("2025-09-16");
    expect(historyDay("Tue, Sep 16, 2025", "2026-09-16")).toBe("2025-09-16");
    expect(historyDay("16 September 2025", "2026-09-16")).toBe("2025-09-16");
    expect(historyDay("January 4", "2026-09-16", "2025-12-31")).toBe(
      "2025-01-04",
    );
  });
  test("rejects ambiguous months, localization, invalid dates and unrelated headings", () => {
    for (const label of [
      "September",
      "September 2025",
      "2026-02-30",
      "Feb 30, 2026",
      "Heute",
      "Last month",
      "Recommended",
      "",
      "09/10/2025",
    ])
      expect(historyDay(label, "2026-09-16")).toBeNull();
  });
});
