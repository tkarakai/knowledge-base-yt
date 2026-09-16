import { describe, expect, it } from "bun:test";

describe("landing-static test infrastructure", () => {
  it("runs bun tests successfully", () => {
    expect(1 + 1).toBe(2);
  });
});
