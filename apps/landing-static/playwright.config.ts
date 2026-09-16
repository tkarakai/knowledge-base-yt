import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./qa/e2e",
  outputDir: "./qa/test-results",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI
    ? [["github"], ["html", { outputFolder: "qa/playwright-report" }]]
    : [["html", { outputFolder: "qa/playwright-report" }]],
  updateSnapshots: "missing",
  snapshotPathTemplate: "{testDir}/__screenshots__/{projectName}/{testFilePath}/{arg}{ext}",
  expect: {
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.01,
      threshold: 0.2,
    },
  },
  use: {
    baseURL: "http://localhost:3004",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npx serve out -l 3004",
    url: "http://localhost:3004",
    reuseExistingServer: !process.env.CI,
    timeout: 30 * 1000,
  },
});
