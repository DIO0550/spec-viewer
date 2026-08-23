import { expect, test, type Page } from "@playwright/test";

import {
  expectNoSeriousAccessibilityViolations,
  installStatefulInvokeBoundary,
  openComposer,
  openRepositoryFile,
  openWorkspace,
} from "./support/review-invoke-boundary";

test.beforeEach(async ({ page }) => {
  await installStatefulInvokeBoundary(page);
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

async function createSpecComment(page: Page): Promise<void> {
  await page.getByRole("button", { name: "コメント追加" }).first().focus();
  await page.keyboard.press("Enter");
  const composer = page.getByRole("textbox", { name: "Review" });
  await composer.fill("Spec review body");
  await page.getByRole("button", { name: "保存" }).click();
  await expect(page.getByText("Spec review body")).toBeVisible();
}

test("[R199-NAV-001] workspace selection loads one worktree", async ({
  page,
}) => {
  await openWorkspace(page, "/workspace/worktree-a");
  await expect(page.getByRole("tab", { name: "Diff" })).toBeEnabled();
});

test("[R199-NAV-002] worktree A-B-A preserves isolated state", async ({
  page,
}) => {
  await openWorkspace(page, "/workspace/worktree-a");
  await openRepositoryFile(page);
  await openWorkspace(page, "/workspace/worktree-b");
  await openWorkspace(page, "/workspace/worktree-a");
  await openRepositoryFile(page);
  await expect(
    page.getByRole("tab", { name: /implementation-plan\.md/ }),
  ).toHaveAttribute("aria-selected", "true");
});

test("[R199-NAV-003] Specs tab switches to Diff tab", async ({ page }) => {
  await openWorkspace(page, "/workspace/worktree-a");
  await page.getByRole("tab", { name: "Diff" }).click();
  await expect(
    page.getByRole("tree", { name: "変更ファイルツリー" }),
  ).toBeVisible();
});

test("[R199-SPEC-004] multiple Markdown artifacts retain tabs", async ({
  page,
}) => {
  await openWorkspace(page, "/workspace/worktree-a");
  await expect(page.getByRole("tab", { name: /Implementation/ })).toBeVisible();
  await expect(page.getByRole("tab", { name: /Tasks/ })).toBeVisible();
});

test("[R199-ARCH-002] successful archive moves spec under Archive", async ({
  page,
}) => {
  await openWorkspace(page, "/workspace/worktree-a");
  await page
    .getByRole("button", { name: /198-diff-commentsをアーカイブへ移動/ })
    .press("Enter");
  await page.getByRole("treeitem", { name: /^Archive/ }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(
    page.getByRole("treeitem", { name: /198-diff-comments/ }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => localStorage.getItem("e2e-archive-count")),
  ).toBe("1");
});

test("[R199-ARCH-004] reload retains archived placement", async ({ page }) => {
  await openWorkspace(page, "/workspace/worktree-a");
  await page
    .getByRole("button", { name: /198-diff-commentsをアーカイブへ移動/ })
    .press("Enter");
  await page.reload();
  await openWorkspace(page, "/workspace/worktree-a");
  await page.getByRole("treeitem", { name: /^Archive/ }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(
    page.getByRole("treeitem", { name: /198-diff-comments/ }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => localStorage.getItem("e2e-archive-count")),
  ).toBe("1");
});

test("[R199-TREE-002] All includes unchanged files", async ({ page }) => {
  await openWorkspace(page, "/workspace/worktree-a");
  await page.getByRole("tab", { name: "Diff" }).click();
  await page.getByRole("tab", { name: "All" }).click();
  await expect(
    page.getByRole("treeitem").filter({ hasText: "notes.md" }),
  ).toBeVisible();
});

for (const [id, mode] of [
  ["R199-VIEW-001", "Unified"],
  ["R199-VIEW-002", "Split"],
  ["R199-VIEW-003", "Editor"],
] as const) {
  test(`[${id}] ${mode} retains active file tab`, async ({ page }) => {
    await openWorkspace(page, "/workspace/worktree-a");
    await openRepositoryFile(page);
    await page.getByRole("radio", { name: mode }).click();
    await expect(
      page.getByRole("tab", { name: /implementation-plan\.md/ }),
    ).toHaveAttribute("aria-selected", "true");
  });
}

test("[R199-REVIEW-001] Spec section creates a comment", async ({ page }) => {
  await openWorkspace(page, "/workspace/worktree-a");
  await createSpecComment(page);
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("e2e-spec-comments") ?? "[]").length,
    ),
  ).toBe(1);
});

test("[R199-REVIEW-002] Diff line creates a comment", async ({ page }) => {
  await openWorkspace(page, "/workspace/worktree-a");
  await openRepositoryFile(page);
  await openComposer(page, "current", 2);
  const composer = page.getByRole("textbox", { name: /2行目へのコメント/ });
  await composer.fill("Diff review");
  await composer.press("Control+Enter");
  await expect(
    page.locator(".diff-review-sidebar").getByText("Diff review"),
  ).toBeVisible();
});

test("[R199-REVIEW-003] resolve changes status filter result", async ({
  page,
}) => {
  await openWorkspace(page, "/workspace/worktree-a");
  await openRepositoryFile(page);
  await openComposer(page, "current", 2);
  const composer = page.getByRole("textbox", { name: /2行目へのコメント/ });
  await composer.fill("Resolve me");
  await composer.press("Control+Enter");
  const lineComment = page.getByRole("button", {
    name: /2行目のコメント1件を表示/,
  });
  await expect(lineComment).toBeVisible();
  await page.getByRole("button", { name: /^解決 comment-/ }).click();
  await expect(lineComment).toBeHidden();
  await page.getByRole("button", { name: /^解決済み 1$/ }).click();
  await page.getByRole("button", { name: /^コメントを展開 comment-/ }).click();
  await expect(
    page.locator(".diff-review-sidebar").getByText("Resolve me"),
  ).toBeVisible();
});

test("[R199-REVIEW-004] card jump focuses line indicator", async ({ page }) => {
  await openWorkspace(page, "/workspace/worktree-a");
  await openRepositoryFile(page);
  await openComposer(page, "current", 2);
  const composer = page.getByRole("textbox", { name: /2行目へのコメント/ });
  await composer.fill("Jump target");
  await composer.press("Control+Enter");
  await page.getByRole("button", { name: /2行目へ移動/ }).click();
  await expect(
    page.getByRole("button", { name: /2行目のコメント1件を表示/ }),
  ).toBeFocused();
});

test("[R199-REVIEW-005] line indicator selects Review card", async ({
  page,
}) => {
  await openWorkspace(page, "/workspace/worktree-a");
  await openRepositoryFile(page);
  await openComposer(page, "current", 2);
  const composer = page.getByRole("textbox", { name: /2行目へのコメント/ });
  await composer.fill("Indicator target");
  await composer.press("Control+Enter");
  await page.getByRole("button", { name: /2行目のコメント1件を表示/ }).click();
  await expect(
    page.locator("article[data-comment-id] button[aria-current=true]"),
  ).toBeVisible();
});

test("[R199-REVIEW-007] Spec Review card jump focuses anchored section", async ({
  page,
}) => {
  await openWorkspace(page, "/workspace/worktree-a");
  await createSpecComment(page);
  const card = page.locator(".comment-thread__select");
  await card.click();
  await expect(card).toHaveAttribute("aria-current", "true");
  await expect(
    page.locator("[data-comment-highlight-state=active]").first(),
  ).toBeVisible();
});

test("[R199-REVIEW-008] Spec section indicator selects Review card", async ({
  page,
}) => {
  await openWorkspace(page, "/workspace/worktree-a");
  await createSpecComment(page);
  const annotationToggle = page.locator(".markdown-comment-annotation__toggle");
  await annotationToggle.scrollIntoViewIfNeeded();
  await annotationToggle.click();
  await page.locator(".markdown-comment-annotation__select").click();
  await expect(page.locator(".comment-thread__select")).toHaveAttribute(
    "aria-current",
    "true",
  );
});

test("[R199-A11Y-001] keyboard jump moves focus to destination", async ({
  page,
}) => {
  await openWorkspace(page, "/workspace/worktree-a");
  await openRepositoryFile(page);
  await page.getByRole("radio", { name: "Unified" }).press("ArrowRight");
  await expect(page.getByRole("radio", { name: "Split" })).toBeFocused();
});

test("[R199-A11Y-003] review has no serious axe violation", async ({
  page,
}) => {
  await openWorkspace(page, "/workspace/worktree-a");
  await expectNoSeriousAccessibilityViolations(page);
});

test("[R199-A11Y-004] narrow review has no serious axe violation", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openWorkspace(page, "/workspace/worktree-a");
  await expectNoSeriousAccessibilityViolations(page);
});

test("[R199-PERF-004] off-window jump materializes focused target", async ({
  page,
}) => {
  await page.evaluate(() => localStorage.setItem("e2e-folded-target", "true"));
  await page.reload();
  await openWorkspace(page, "/workspace/worktree-a");
  await openRepositoryFile(page);
  await page.getByRole("button", { name: /current 150行目へ移動/ }).click();
  await expect(
    page.getByRole("button", { name: /current 150行目のコメント1件を表示/ }),
  ).toBeFocused();
});
