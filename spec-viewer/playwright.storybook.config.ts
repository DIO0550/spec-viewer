import { defineConfig, devices } from "@playwright/test";
import { storybookPlaywrightTestMatches } from "./playwright.test-matches";

export default defineConfig({
  testDir: "./e2e",
  testMatch: [...storybookPlaywrightTestMatches],
  outputDir: "./test-results/storybook-playwright",
  fullyParallel: false,
  reporter: "line",
  use: {
    baseURL: "http://127.0.0.1:6006",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "pnpm exec storybook dev -p 6006 --no-open --host 127.0.0.1",
    url: "http://127.0.0.1:6006",
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
