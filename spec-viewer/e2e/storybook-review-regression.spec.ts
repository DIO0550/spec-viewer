import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("Spec本文はマウスのドラッグ選択を保持する", async ({ page }) => {
  await page.goto(
    "/iframe.html?id=features-specs-components-markdownviewer--highlighted-selection-surface&viewMode=story",
  );
  const paragraph = page.locator(".markdown-rendered p").first();
  await expect(paragraph).toBeVisible();
  const bounds = await paragraph.boundingBox();
  expect(bounds).not.toBeNull();
  if (bounds === null) {
    return;
  }

  const y = bounds.y + Math.min(bounds.height / 2, 10);
  await page.mouse.move(bounds.x + 4, y);
  await page.mouse.down();
  await page.mouse.move(bounds.x + Math.min(bounds.width - 4, 320), y, {
    steps: 12,
  });
  await page.mouse.up();

  const selectedText = await page.evaluate(
    () => window.getSelection()?.toString() ?? "",
  );
  expect(selectedText.trim().length).toBeGreaterThan(0);
});

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
  await page.goto(
    "/iframe.html?id=app-reviewregression--split&viewMode=story&globals=a11y.manual:!true",
  );
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
    "/iframe.html?id=app-reviewregression--all-lazy&viewMode=story&globals=a11y.manual:!true",
  );
  const results = await new AxeBuilder({ page }).analyze();
  expect(
    results.violations.filter(
      ({ impact }) => impact === "serious" || impact === "critical",
    ),
  ).toEqual([]);
});

test("主要なファイル名とworktree名を14pxで表示する", async ({ page }) => {
  await page.goto(
    "/iframe.html?id=components-workspacelayout--default&viewMode=story",
  );
  await expect(page.locator(".view-mode-toolbar__item")).toHaveCSS(
    "font-size",
    "14px",
  );
  await expect(page.locator(".worktree-tree__label").first()).toHaveCSS(
    "font-size",
    "14px",
  );
  await expect(page.locator(".spec-tree__item-label").first()).toHaveCSS(
    "font-size",
    "14px",
  );

  await page.goto(
    "/iframe.html?id=features-repositorydiff-components-repositorydifftree--all-props&viewMode=story",
  );
  await expect(page.locator(".repository-diff-tree__name").first()).toHaveCSS(
    "font-size",
    "14px",
  );

  await page.goto(
    "/iframe.html?id=features-repositorydiff-components-repositoryfiletabs--all-props&viewMode=story",
  );
  await expect(page.locator(".repository-file-tab__path").first()).toHaveCSS(
    "font-size",
    "14px",
  );
});

test("MarkdownViewerはmermaidコードブロックをSVG図として描画する", async ({
  page,
}) => {
  test.slow();
  await page.goto(
    "/iframe.html?id=features-specs-components-markdownviewer--mermaid-diagram&viewMode=story",
    { waitUntil: "domcontentloaded" },
  );

  const diagramBlock = page.locator(
    '.markdown-rendered__mermaid[data-block-type="code"]',
  );

  await expect(diagramBlock).toHaveAttribute("data-block-index", "1");
  await expect(diagramBlock.locator("svg")).toBeVisible();
  await expect(diagramBlock).toContainText("Draft spec");
  await expect(page.getByRole("alert")).toHaveCount(0);
});
