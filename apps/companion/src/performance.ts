/** Bounded, local-only diagnostics. Never retain IDs, titles, queries or credentials. */
export class PerformanceMetrics {
  private samples = new Map<
    string,
    { count: number; errors: number; values: number[]; bytes: number }
  >();
  private lag: number[] = [];
  private timer: ReturnType<typeof setInterval>;
  constructor() {
    let expected = performance.now() + 100;
    this.timer = setInterval(() => {
      const at = performance.now();
      this.lag.push(Math.max(0, at - expected));
      if (this.lag.length > 300) this.lag.shift();
      expected = at + 100;
    }, 100);
    this.timer.unref();
  }
  record(operation: string, ms: number, error = false, bytes = 0) {
    if (!this.samples.has(operation) && this.samples.size >= 100)
      operation = "other";
    let entry = this.samples.get(operation);
    if (!entry) {
      entry = { count: 0, errors: 0, values: [], bytes: 0 };
      this.samples.set(operation, entry);
    }
    entry.count++;
    entry.errors += Number(error);
    entry.bytes += bytes;
    entry.values.push(ms);
    if (entry.values.length > 200) entry.values.shift();
  }
  snapshot() {
    const summarize = (values: number[]) => {
      const sorted = [...values].sort((a, b) => a - b);
      const percentile = (p: number) =>
        Math.round(
          (sorted[Math.max(0, Math.ceil(sorted.length * p) - 1)] ?? 0) * 100,
        ) / 100;
      return {
        samples: sorted.length,
        p50Ms: percentile(0.5),
        p95Ms: percentile(0.95),
        maxMs: percentile(1),
      };
    };
    const memory = process.memoryUsage();
    return {
      uptimeSeconds: Math.round(process.uptime()),
      memory: { rssBytes: memory.rss, heapUsedBytes: memory.heapUsed },
      eventLoopLag: summarize(this.lag),
      operations: Object.fromEntries(
        [...this.samples].map(([name, entry]) => [
          name,
          {
            count: entry.count,
            errors: entry.errors,
            bytes: entry.bytes,
            ...summarize(entry.values),
          },
        ]),
      ),
    };
  }
  close() {
    clearInterval(this.timer);
  }
}
export function metricRoute(request: Request) {
  const parts = new URL(request.url).pathname.split("/").filter(Boolean);
  const [resource, item, action, subaction] = parts;
  if (
    ![
      "sources",
      "knowledge",
      "proposals",
      "documents",
      "history",
      "metadata",
      "index",
      "health",
      "settings",
      "timeline",
      "jobs",
      "search",
      "metrics",
    ].includes(resource)
  )
    return "other";
  if (["GET", "PUT", "POST", "OPTIONS"].includes(request.method) === false)
    return "other";
  const route = [resource];
  if (item)
    route.push(
      ["sources", "knowledge", "proposals", "documents"].includes(resource)
        ? item === "page" && resource === "sources"
          ? "page"
          : ":id"
        : [
              "status",
              "refresh",
              "connection",
              "pair",
              "batches",
              "pair-code",
              "disconnect",
              "rebuild",
            ].includes(item)
          ? item
          : "other",
    );
  if (action)
    route.push(
      ["media", "transcript", "reflection", "synthesize", "review"].includes(
        action,
      )
        ? action
        : "other",
    );
  if (subaction)
    route.push(
      ["thumbnail", "avatar", "retry"].includes(subaction)
        ? subaction
        : "other",
    );
  return `${request.method} /${route.join("/")}`;
}
