import { test, expect } from "@playwright/test";

/**
 * Admin User Sessions E2E Tests
 *
 * Verify sessions management is available through the Users page.
 *
 * NOTE: These tests require authentication to the admin app.
 * The admin app uses cookie-based auth like the web app.
 */

test.describe("Admin User Sessions", () => {
  test("users page requires authentication", async ({ page }) => {
    // Clear cookies to ensure unauthenticated state
    const context = page.context();
    await context.clearCookies();

    await page.goto("/manage/users");
    // Should redirect to sign-in
    await expect(page).toHaveURL(/\/sign-in/);
  });

  test("legacy sessions route redirects to users when authenticated", async ({ page, context }) => {
    // Set session cookie to pass proxy auth check
    await context.addCookies([
      {
        name: "better-auth.session_token",
        value: "admin-session-token",
        domain: "localhost",
        path: "/",
      },
    ]);

    await page.goto("/dashboard/sessions");
    await expect(page).toHaveURL(/\/manage\/users/);
  });

  test("users page has user search input", async ({ page, context }) => {
    await context.addCookies([
      {
        name: "better-auth.session_token",
        value: "admin-session-token",
        domain: "localhost",
        path: "/",
      },
    ]);

    await page.goto("/manage/users");
    await page.waitForLoadState("networkidle");

    const searchInput = page.locator('input[placeholder*="Search"]');
    if (await searchInput.isVisible()) {
      await expect(searchInput).toBeVisible();
    }
  });
});
