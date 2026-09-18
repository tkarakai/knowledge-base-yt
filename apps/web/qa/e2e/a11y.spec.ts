import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.describe("Accessibility", () => {
  test("sign-in form fields have proper labels", async ({ page }) => {
    await page.goto("/sign-in");
    await page.waitForLoadState("networkidle");

    const results = await new AxeBuilder({ page })
      .withRules(["label", "label-title-only", "autocomplete-valid"])
      .analyze();

    expect(results.violations).toHaveLength(0);
  });

  test("homepage is keyboard navigable", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const body = page.locator("body");
    await body.press("Tab");

    const focusedElement = page.locator(":focus");
    await expect(focusedElement).toBeVisible();

    await page.keyboard.press("Tab");
    const secondFocusedElement = page.locator(":focus");
    await expect(secondFocusedElement).toBeVisible();
  });
});
