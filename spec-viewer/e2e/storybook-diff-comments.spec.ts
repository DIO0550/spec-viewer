import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const storyUrl = (storyId: string, globals = "a11y.manual:!true"): string =>
  `/iframe.html?id=${storyId}&viewMode=story&globals=${globals}`;

const statefulStoryIds = [
  "diff-comments-statefulworkspace--create-jump-refresh",
  "diff-comments-statefulworkspace--pending-identity-aba",
  "diff-comments-statefulworkspace--stale-reanchor-and-discard",
  "diff-comments-statefulworkspace--base-editor-hide-restore",
  "diff-comments-statefulworkspace--all-unchanged-persistence",
] as const;

for (const storyId of statefulStoryIds) {
  test(`${storyId} playとaxeが成功する`, async ({ page }) => {
    await page.goto(storyUrl(storyId));
    await expect(page.locator("#storybook-root")).not.toBeEmpty();
    await expect(page.locator("body")).not.toContainText(
      "This story failed to render",
    );
    await expect(page.locator("body")).not.toContainText(
      "play function failed",
    );
    const results = await new AxeBuilder({ page }).analyze();
    expect(
      results.violations.filter(
        ({ impact }) => impact === "serious" || impact === "critical",
      ),
    ).toEqual([]);
  });
}

test("stateful workspace storyはdark themeでもaxeが成功する", async ({
  page,
}) => {
  await page.goto(
    storyUrl(
      "diff-comments-statefulworkspace--create-jump-refresh",
      "theme:Dark;a11y.manual:!true",
    ),
  );
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  const results = await new AxeBuilder({ page }).analyze();
  expect(
    results.violations.filter(
      ({ impact }) => impact === "serious" || impact === "critical",
    ),
  ).toEqual([]);
});

test("10k Review storyのplayが選択card focusと100 card上限を検証する", async ({
  page,
}) => {
  await page.goto(
    "/iframe.html?id=features-diffcomments-components-diffreviewsidebar--large-review-list&viewMode=story",
  );
  await expect(page.locator("article[data-comment-id]")).toHaveCount(100);
  await expect(
    page.getByRole("button", {
      name: "src/large.ts current 10000行目のコメントを選択",
    }),
  ).toBeFocused();
});
