import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const requiredStories = [
  "specs-hierarchy",
  "archive",
  "progress",
  "changed-tree",
  "all-lazy",
  "unified",
  "split",
  "editor",
  "conflict",
  "stale",
  "review-filters",
  "convergence",
  "unmanaged",
  "base-error",
  "read-denied",
  "deleted-file",
] as const;

for (const name of requiredStories) {
  test(`review regression ${name} renders and its play succeeds`, async ({
    page,
  }) => {
    await page.goto(
      `/iframe.html?id=app-reviewregression--${name}&viewMode=story`,
    );
    await expect(
      page.getByRole("main", { name: "Review regression fixture" }),
    ).toBeVisible();
    await expect(page.locator("body")).not.toContainText(
      "play function failed",
    );
  });
}

test("[R199-A11Y-003] dark review story has no serious axe violation", async ({
  page,
}) => {
  await page.goto("/iframe.html?id=app-reviewregression--split&viewMode=story");
  const results = await new AxeBuilder({ page }).analyze();
  expect(
    results.violations.filter(
      ({ impact }) => impact === "serious" || impact === "critical",
    ),
  ).toEqual([]);
});

test("[R199-A11Y-004] narrow review story has no serious axe violation", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(
    "/iframe.html?id=app-reviewregression--all-lazy&viewMode=story",
  );
  const results = await new AxeBuilder({ page }).analyze();
  expect(
    results.violations.filter(
      ({ impact }) => impact === "serious" || impact === "critical",
    ),
  ).toEqual([]);
});
