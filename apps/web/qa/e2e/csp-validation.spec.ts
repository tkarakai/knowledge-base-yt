import { test, expect } from "@playwright/test";

/**
 * Content Security Policy Tests
 *
 * Verify that the CSP header set by proxy.ts is correct, uses a unique nonce
 * per request, and includes all required directives.
 */

test.describe("Content Security Policy", () => {
  test("CSP header is present on page responses", async ({ page }) => {
    const response = await page.goto("/");
    expect(response).not.toBeNull();

    const csp = response!.headers()["content-security-policy"];
    expect(csp).toBeDefined();
    expect(csp.length).toBeGreaterThan(0);
  });

  test("CSP includes nonce-based script-src with strict-dynamic", async ({
    page,
  }) => {
    const response = await page.goto("/");
    const csp = response!.headers()["content-security-policy"];

    // Nonce format: 'nonce-<base64>'
    expect(csp).toMatch(/script-src 'self' 'nonce-[A-Za-z0-9+/=]+' 'strict-dynamic'/);
  });

  test("CSP includes frame-ancestors 'none'", async ({ page }) => {
    const response = await page.goto("/");
    const csp = response!.headers()["content-security-policy"];

    expect(csp).toContain("frame-ancestors 'none'");
  });

  test("CSP includes object-src 'none'", async ({ page }) => {
    const response = await page.goto("/");
    const csp = response!.headers()["content-security-policy"];

    expect(csp).toContain("object-src 'none'");
  });

  test("CSP includes base-uri 'self'", async ({ page }) => {
    const response = await page.goto("/");
    const csp = response!.headers()["content-security-policy"];

    expect(csp).toContain("base-uri 'self'");
  });

  test("CSP includes form-action 'self'", async ({ page }) => {
    const response = await page.goto("/");
    const csp = response!.headers()["content-security-policy"];

    expect(csp).toContain("form-action 'self'");
  });

  test("CSP connect-src allows Convex cloud origins", async ({ page }) => {
    const response = await page.goto("/");
    const csp = response!.headers()["content-security-policy"];

    expect(csp).toContain("connect-src");
    // In dev, local Convex origins are added; in prod, cloud origins
    // Both should always have these:
    expect(csp).toMatch(/connect-src [^;]*https:\/\/\*\.convex\.cloud/);
    expect(csp).toMatch(/connect-src [^;]*wss:\/\/\*\.convex\.cloud/);
  });

  test("CSP nonce changes between requests", async ({ page }) => {
    const response1 = await page.goto("/");
    const csp1 = response1!.headers()["content-security-policy"];

    const response2 = await page.goto("/");
    const csp2 = response2!.headers()["content-security-policy"];

    // Extract nonces
    const nonceRegex = /nonce-([A-Za-z0-9+/=]+)/;
    const nonce1 = csp1.match(nonceRegex)?.[1];
    const nonce2 = csp2.match(nonceRegex)?.[1];

    expect(nonce1).toBeDefined();
    expect(nonce2).toBeDefined();
    expect(nonce1).not.toBe(nonce2);
  });

  test("CSP is also present on sign-in page", async ({ page }) => {
    const response = await page.goto("/en/sign-in");
    const csp = response!.headers()["content-security-policy"];

    expect(csp).toBeDefined();
    expect(csp).toContain("script-src");
    expect(csp).toContain("frame-ancestors 'none'");
  });
});
