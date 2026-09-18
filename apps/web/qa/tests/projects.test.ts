import { describe, expect, it } from "bun:test";

import { normalizeText } from "../../src/lib/projects";

describe("normalizeText", () => {
  it("trims and normalizes whitespace", () => {
    expect(normalizeText("  My  project  ")).toBe("My project");
  });

  it("returns empty string for blank input", () => {
    expect(normalizeText("   ")).toBe("");
  });
});
