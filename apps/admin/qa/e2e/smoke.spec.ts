import { test, expect, type ConsoleMessage } from "@playwright/test";

test.describe("Admin Sign-In Page", () => {
  test("loads and displays the correct title", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle("Admin - Web App Starter");
  });

  test("displays the sign-in form", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Password")).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
  });

  test("has no console errors on load", async ({ page }) => {
    const consoleErrors: ConsoleMessage[] = [];

    const isExpectedError = (text: string, locationUrl: string): boolean => {
      const isAuthSessionUrl = /\/api\/auth\/get-session/.test(locationUrl);
      const is400Error = /400|Bad Request/.test(text);
      const isFailedToLoad = /Failed to load resource/.test(text);

      if (isAuthSessionUrl && (is400Error || isFailedToLoad)) {
        return true;
      }

      if (/\/api\/auth\/get-session.*400/.test(text)) {
        return true;
      }

      return false;
    };

    page.on("console", (message) => {
      if (message.type() === "error") {
        const text = message.text();
        const locationUrl = message.location().url;
        if (!isExpectedError(text, locationUrl)) {
          consoleErrors.push(message);
        }
      }
    });

    await page.goto("/");
    await page.waitForLoadState("networkidle");
    expect(consoleErrors).toHaveLength(0);
  });

  test("main element is visible", async ({ page }) => {
    await page.goto("/");
    const mainElement = page.locator("main");
    await expect(mainElement).toBeVisible();
  });
});
