import { test, expect } from "@playwright/test";

/**
 * Security Header Tests
 *
 * Verify that all required HTTP security headers are present on responses.
 * Headers are configured in next.config.ts (static headers) and proxy.ts (CSP).
 */

const EXPECTED_HEADERS: Record<string, string> = {
  "x-frame-options": "DENY",
  "x-content-type-options": "nosniff",
  "referrer-policy": "strict-origin-when-cross-origin",
  "permissions-policy": "camera=(), microphone=(), geolocation=()",
  "x-xss-protection": "0",
};

test.describe("Security Headers", () => {
  test("homepage includes all security headers", async ({ page }) => {
    const response = await page.goto("/");
    expect(response).not.toBeNull();

    const headers = response!.headers();
    for (const [name, value] of Object.entries(EXPECTED_HEADERS)) {
      expect(headers[name], `Missing or wrong header: ${name}`).toBe(value);
    }
  });

  test("sign-in page includes all security headers", async ({ page }) => {
    const response = await page.goto("/en/sign-in");
    expect(response).not.toBeNull();

    const headers = response!.headers();
    for (const [name, value] of Object.entries(EXPECTED_HEADERS)) {
      expect(headers[name], `Missing or wrong header: ${name}`).toBe(value);
    }
  });

  test("protected route redirect includes security headers", async ({ page }) => {
    // Accessing /dashboard without auth should redirect to /sign-in.
    // Even the redirect response should carry security headers.
    const response = await page.goto("/en/dashboard", {
      waitUntil: "commit",
    });
    expect(response).not.toBeNull();

    const headers = response!.headers();
    // After redirect chain, final response should have headers
    for (const [name, value] of Object.entries(EXPECTED_HEADERS)) {
      expect(headers[name], `Missing or wrong header: ${name}`).toBe(value);
    }
  });

  test("HSTS header is present with correct max-age", async ({ page }) => {
    const response = await page.goto("/");
    expect(response).not.toBeNull();

    const hsts = response!.headers()["strict-transport-security"];
    expect(hsts).toContain("max-age=63072000");
    expect(hsts).toContain("includeSubDomains");
  });

  test("rate limit headers are present on successful responses", async ({
    page,
  }) => {
    const response = await page.goto("/");
    expect(response).not.toBeNull();

    const headers = response!.headers();
    expect(headers["x-ratelimit-limit"]).toBeDefined();
    expect(headers["x-ratelimit-remaining"]).toBeDefined();
    expect(headers["x-ratelimit-reset"]).toBeDefined();
  });
});
