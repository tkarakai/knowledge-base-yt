/** Invoked by scripts/kb-e2e.ts against its disposable vault and real model adapter. */
import { expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { join } from "node:path";

export async function experienceJourney({
  page,
  base,
  screenshots,
  prepare,
}: {
  page: Page;
  base: string;
  screenshots: string;
  prepare: (concept: string) => void;
}): Promise<void> {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`${base}/kb`);
  await page.getByRole("link", { name: "Experience lab", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "A different way to make it yours." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Mark favorite" }).nth(1).click();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Your favorite" }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.screenshot({
    path: join(screenshots, "ux-gallery.png"),
    fullPage: true,
    animations: "disabled",
  });
  for (const concept of ["workbench", "pipeline", "library"]) {
    const root = `${base}/kb/explore/${concept}`;
    prepare(concept);
    await page.goto(root);
    await expect(page.locator(".ux-page-heading")).toBeVisible();
    await expect(
      page.getByRole("button", {
        name: "Local companion connected",
        exact: true,
      }),
    ).toBeVisible();
    const audit = await new AxeBuilder({ page })
      .include(".ux-app")
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(
      audit.violations.map((v) => ({
        id: v.id,
        nodes: v.nodes.map((n) => ({
          target: n.target,
          summary: n.failureSummary,
        })),
      })),
    ).toEqual([]);
    await page.screenshot({
      path: join(screenshots, `ux-${concept}.png`),
      fullPage: true,
      animations: "disabled",
    });
    if (
      concept === "workbench" &&
      (await page.getByRole("button", { name: "Next source page" }).isEnabled())
    ) {
      await page.getByRole("button", { name: "Next source page" }).click();
      await expect(page.locator(".ux-pagination")).toContainText("Page 2 of");
      await page.getByLabel("Find a source").fill("Scale fixture 09999");
      await expect(page.locator(".ux-queue-list .ux-source-row")).toHaveCount(
        1,
      );
      await expect(page.locator(".ux-queue-list")).toContainText(
        "Scale fixture 09999",
      );
      await page.getByLabel("Find a source").clear();
    }
    if (concept === "library") {
      await page
        .getByRole("navigation", { name: "Experience navigation" })
        .getByRole("link", { name: "Capture inbox" })
        .click();
      await page
        .getByLabel("What have you been watching?", { exact: false })
        .fill("https://youtu.be/dQw4w9WgXcQ");
      await page
        .getByRole("button", { name: "Add to inbox", exact: true })
        .click();
    } else {
      await page
        .getByLabel("Add a source", { exact: true })
        .fill("https://youtu.be/dQw4w9WgXcQ");
      await page
        .getByRole("button", { name: "Add video", exact: true })
        .click();
    }
    await expect(page).toHaveURL(`${root}/sources/youtube%3AdQw4w9WgXcQ`);
    await expect(
      page.getByRole("heading", {
        name: "Building a memory that lasts",
        exact: true,
      }),
    ).toBeVisible();
    await page.getByRole("radio", { name: "Keep", exact: true }).check();
    await page
      .getByRole("checkbox", { name: "Select passage at 0:00" })
      .check();
    await page
      .getByRole("checkbox", { name: "Select passage at 0:12" })
      .check();
    await page
      .getByLabel("Why is it worth keeping?")
      .fill(`A complete ${concept} workflow should keep my context.`);
    await page
      .getByRole("button", { name: "Save reflection", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Propose connections", exact: true }),
    ).toBeEnabled();
    await page.reload();
    await expect(page.getByLabel("Why is it worth keeping?")).toHaveValue(
      `A complete ${concept} workflow should keep my context.`,
    );
    await page.screenshot({
      path: join(screenshots, `ux-${concept}-reflection.png`),
      fullPage: true,
      animations: "disabled",
    });
    await page
      .getByRole("button", { name: "Propose connections", exact: true })
      .click();
    await expect(page).toHaveURL(`${root}/proposals`);
    const change = page.getByRole("region", {
      name: `Change 1: ${concept} memory`,
    });
    await expect(change).toBeVisible();
    await change
      .getByRole("button", { name: "Edit Markdown", exact: true })
      .click();
    await change
      .getByLabel("Proposed Markdown · editable")
      .fill(`# ${concept} memory\n\nPortable notes reviewed in ${concept}.`);
    await change.getByRole("radio", { name: "Accept change" }).check();
    await page
      .getByRole("region", { name: "Change 2: Derived indexes" })
      .getByRole("radio", { name: "Reject change" })
      .check();
    await page
      .getByRole("button", { name: "Apply selected decisions", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Nothing waiting for your red pen." }),
    ).toBeVisible();
    await page.goto(`${root}/knowledge/knowledge%3Aux-${concept}`);
    await expect(
      page.getByText(`Portable notes reviewed in ${concept}.`, { exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Edit Markdown", exact: true })
      .click();
    await page
      .getByLabel("Markdown", { exact: true })
      .fill(`# ${concept} memory\n\nPortable notes refined in ${concept}.`);
    await page.getByRole("button", { name: "Save note", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("Note saved");
    await page.goto(`${root}/search`);
    await page
      .getByLabel("Search your knowledge")
      .fill(`refined in ${concept}`);
    await page.getByRole("button", { name: "Search", exact: true }).click();
    const hit = page
      .getByRole("link", { name: `${concept} memory`, exact: false })
      .first();
    await expect(hit).toHaveAttribute(
      "href",
      `/kb/explore/${concept}/knowledge/knowledge%3Aux-${concept}`,
    );
    await hit.click();
    await expect(
      page.getByText(`Portable notes refined in ${concept}.`, { exact: true }),
    ).toBeVisible();
    // Switching experiences preserves the current resource, and browser back restores the direction.
    const next = concept === "library" ? "workbench" : "library";
    await page.getByLabel("EXPERIENCE", { exact: true }).selectOption(next);
    await expect(page).toHaveURL(
      `${base}/kb/explore/${next}/knowledge/knowledge%3Aux-${concept}`,
    );
    await page.goBack();
    await expect(page).toHaveURL(`${root}/knowledge/knowledge%3Aux-${concept}`);
    for (const route of [
      "",
      "/inbox",
      "/sources/youtube%3AdQw4w9WgXcQ",
      "/knowledge",
      "/proposals",
      "/settings",
      "/search",
      "/timeline",
    ]) {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(root + route);
      await expect(page.locator("#ux-main")).toBeVisible();
      await expect(page.locator(".kb-loading")).toHaveCount(0);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
        `${concept}${route} must reflow on mobile`,
      ).toBe(true);
    }
    await page.goto(root);
    await page
      .getByRole("button", { name: "Open navigation", exact: true })
      .click();
    await page
      .getByRole("navigation", { name: "Experience navigation" })
      .getByRole("link", { name: "Search everything" })
      .click();
    await expect(page).toHaveURL(`${root}/search`);
    await expect(
      page.getByRole("button", { name: "Open navigation", exact: true }),
    ).toHaveAttribute("aria-expanded", "false");
    await page.goto(root);
    await page
      .getByRole("button", { name: "Open navigation", exact: true })
      .click();
    await page.keyboard.press("Escape");
    await expect(
      page.getByRole("button", { name: "Open navigation", exact: true }),
    ).toBeFocused();
    await page.setViewportSize({ width: 320, height: 800 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
      `${concept} reflows at 320px`,
    ).toBe(true);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({
      path: join(screenshots, `ux-${concept}-mobile.png`),
      fullPage: true,
      animations: "disabled",
    });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(root);
    await page.getByRole("link", { name: "Original app", exact: true }).click();
    await expect(page).toHaveURL(`${base}/kb`);
  }
  console.log(
    "PASS: all three experience capture → reflect → synthesize → review → edit → search journeys, switching, accessibility, and mobile routes.",
  );
}
