import { beforeEach, describe, expect, it } from "bun:test";
import { checkEdgeRateLimit, _resetStore } from "@repo/edge-rate-limit";

beforeEach(() => {
  _resetStore();
});

describe("checkEdgeRateLimit", () => {
  const config = { windowSeconds: 60, maxRequests: 5, maxMapSize: 100 };

  it("allows requests under the limit", () => {
    const result = checkEdgeRateLimit("1.2.3.4", config);

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
  });

  it("decrements remaining on each request", () => {
    checkEdgeRateLimit("1.2.3.4", config);
    checkEdgeRateLimit("1.2.3.4", config);
    const result = checkEdgeRateLimit("1.2.3.4", config);

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(2);
  });

  it("blocks requests that exceed the limit", () => {
    for (let i = 0; i < 5; i++) {
      checkEdgeRateLimit("1.2.3.4", config);
    }
    const result = checkEdgeRateLimit("1.2.3.4", config);

    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it("includes resetAt timestamp in the future", () => {
    const before = Date.now();
    const result = checkEdgeRateLimit("1.2.3.4", config);

    expect(result.resetAt).toBeGreaterThanOrEqual(before + 59_000);
    expect(result.resetAt).toBeLessThanOrEqual(before + 61_000);
  });

  it("isolates limits by IP address", () => {
    const tightConfig = { windowSeconds: 60, maxRequests: 1, maxMapSize: 100 };

    checkEdgeRateLimit("1.1.1.1", tightConfig);
    const result = checkEdgeRateLimit("2.2.2.2", tightConfig);

    expect(result.allowed).toBe(true);
  });

  it("rejects new IPs when map is at capacity (fail-closed)", () => {
    const smallMapConfig = { windowSeconds: 60, maxRequests: 100, maxMapSize: 3 };

    checkEdgeRateLimit("ip-1", smallMapConfig);
    checkEdgeRateLimit("ip-2", smallMapConfig);
    checkEdgeRateLimit("ip-3", smallMapConfig);

    // 4th unique IP — map is full
    const result = checkEdgeRateLimit("ip-4", smallMapConfig);

    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it("still allows existing IPs when map is at capacity", () => {
    const smallMapConfig = { windowSeconds: 60, maxRequests: 100, maxMapSize: 3 };

    checkEdgeRateLimit("ip-1", smallMapConfig);
    checkEdgeRateLimit("ip-2", smallMapConfig);
    checkEdgeRateLimit("ip-3", smallMapConfig);

    // Existing IP — should still work
    const result = checkEdgeRateLimit("ip-1", smallMapConfig);

    expect(result.allowed).toBe(true);
  });
});
