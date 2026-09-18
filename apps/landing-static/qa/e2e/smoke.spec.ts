import { test, expect, type ConsoleMessage } from "@playwright/test";

test.describe("Landing Static Homepage", () => {
  test("loads and displays the correct title", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle("Web App Starter");
  });

  test("displays main heading", async ({ page }) => {
    await page.goto("/");
    const heading = page.getByRole("heading", { level: 1 });
    await expect(heading).toBeVisible();
  });

  test("has no console errors on load", async ({ page }) => {
    const consoleErrors: ConsoleMessage[] = [];

    page.on("console", (message) => {
      if (message.type() === "error") {
        consoleErrors.push(message);
      }
    });

    await page.goto("/");
    await page.waitForLoadState("networkidle");
    expect(consoleErrors).toHaveLength(0);
  });

  test("page has proper heading hierarchy", async ({ page }) => {
    await page.goto("/");
    const h1Elements = page.getByRole("heading", { level: 1 });
    await expect(h1Elements).toHaveCount(1);
    const mainElement = page.locator("main");
    await expect(mainElement).toBeVisible();
  });
});

test.describe("Footer", () => {
  test("displays footer with legal links", async ({ page }) => {
    await page.goto("/");
    const footer = page.locator("footer");
    await expect(footer).toBeVisible();
    await expect(footer.getByRole("link", { name: "About" })).toBeVisible();
    await expect(
      footer.getByRole("link", { name: "Privacy Policy" }),
    ).toBeVisible();
    await expect(
      footer.getByRole("link", { name: "Terms of Service" }),
    ).toBeVisible();
  });
});

test.describe("Legal Pages", () => {
  test("about page loads with correct heading", async ({ page }) => {
    await page.goto("/about");
    await expect(page).toHaveTitle("About - Web App Starter");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("About");
  });

  test("privacy page loads with correct heading", async ({ page }) => {
    await page.goto("/privacy");
    await expect(page).toHaveTitle("Privacy Policy - Web App Starter");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Privacy Policy",
    );
  });

  test("terms page loads with correct heading", async ({ page }) => {
    await page.goto("/terms");
    await expect(page).toHaveTitle("Terms of Service - Web App Starter");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Terms of Service",
    );
  });

  test("legal pages have back-to-home navigation", async ({ page }) => {
    await page.goto("/about");
    const backLink = page.getByRole("link", { name: /back to home/i });
    await expect(backLink).toBeVisible();
    await backLink.click();
    await expect(page).toHaveURL("/");
  });
});
