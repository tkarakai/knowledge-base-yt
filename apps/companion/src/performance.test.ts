import { expect, test } from "bun:test";
import { PerformanceMetrics, metricRoute } from "./performance";
test("metrics are bounded and never label operations with user titles, query text or IDs", () => {
  const metrics = new PerformanceMetrics();
  try {
    for (let i = 0; i < 1000; i++) metrics.record("GET /sources/page", i);
    const sample = metrics.snapshot().operations["GET /sources/page"];
    expect(sample.samples).toBe(200);
    expect(sample.count).toBe(1000);
    expect(sample.p95Ms).toBe(989);
    expect(
      metricRoute(
        new Request(
          "http://127.0.0.1/sources/youtube:private-id/media/avatar?q=personal",
        ),
      ),
    ).toBe("GET /sources/:id/media/avatar");
    expect(metricRoute(new Request("http://127.0.0.1/search?q=personal"))).toBe(
      "GET /search",
    );
  } finally {
    metrics.close();
  }
});
