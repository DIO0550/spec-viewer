import { expect, test } from "@playwright/test";
import {
  expectNoSeriousAccessibilityViolations,
  installStatefulInvokeBoundary,
  openComposer,
  openRepositoryFile,
  openWorkspace,
  seedConvergedComments,
} from "./support/review-invoke-boundary";

test.beforeEach(async ({ page }) => {
  await installStatefulInvokeBoundary(page);
  await page.goto("/");
  await openWorkspace(page, "/workspace/worktree-a");
});

test("actual Appでworkspace tree tab mode Reviewを通して作成・resolve・jumpする", async ({
  page,
}) => {
  await openRepositoryFile(page);
  await openComposer(page, "base", 2);
  const composer = page.getByRole("textbox", { name: /2行目へのコメント/ });
  await composer.fill("Review from actual App");
  await composer.press("Control+Enter");

  await expect(
    page.locator(".diff-review-sidebar").getByText("Review from actual App"),
  ).toBeVisible();
  await expect(page.locator(".diff-inline-comment-thread")).toContainText(
    "Review from actual App",
  );
  await page.getByRole("button", { name: /^解決 comment-/ }).click();
  await page.getByRole("button", { name: /^解決済み 1$/ }).click();
  await page.getByRole("button", { name: /^コメントを展開 comment-/ }).click();
  await expect(
    page.locator(".diff-review-sidebar").getByText("Review from actual App"),
  ).toBeVisible();

  await page.getByRole("radio", { name: "Editor" }).click();
  await page.getByRole("button", { name: /2行目へ移動/ }).click();
  await expect(page.getByRole("radio", { name: "Unified" })).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await page.getByRole("radio", { name: "Split" }).click();
  await expect(page.getByRole("radio", { name: "Split" })).toHaveAttribute(
    "aria-checked",
    "true",
  );
});

test("actual AppでCAS conflict draftを保持しreloadとA-B-Aでidentityを分離する", async ({
  page,
}) => {
  await openRepositoryFile(page);
  await page.evaluate(() => localStorage.setItem("e2e-conflict-once", "true"));
  await openComposer(page, "current", 2);
  const composer = page.getByRole("textbox", { name: /2行目へのコメント/ });
  await composer.fill("Conflict-safe draft");
  await composer.press("Control+Enter");
  await expect(page.getByRole("alert")).toContainText("競合");
  await expect(composer).toHaveValue("Conflict-safe draft");
  await composer.press("Control+Enter");
  await expect(
    page.locator(".diff-review-sidebar").getByText("Conflict-safe draft"),
  ).toBeVisible();

  await openWorkspace(page, "/workspace/worktree-b");
  await openRepositoryFile(page);
  await expect(
    page.locator(".diff-review-sidebar").getByText("Conflict-safe draft"),
  ).toBeHidden();
  await openWorkspace(page, "/workspace/worktree-a");
  await openRepositoryFile(page);
  await expect(
    page.locator(".diff-review-sidebar").getByText("Conflict-safe draft"),
  ).toBeVisible();

  await page.reload();
  await openWorkspace(page, "/workspace/worktree-a");
  await openRepositoryFile(page);
  await expect(
    page.locator(".diff-review-sidebar").getByText("Conflict-safe draft"),
  ).toBeVisible();
});

test("actual Appでstale保存後に本文を保持して最新snapshotへ再保存できる", async ({
  page,
}) => {
  await openRepositoryFile(page);
  await page.evaluate(() =>
    localStorage.setItem("e2e-stale-save-once", "true"),
  );
  await openComposer(page, "current", 2);
  const composer = page.getByRole("textbox", { name: /2行目へのコメント/ });
  await composer.fill("Retry after snapshot refresh");
  await composer.press("Control+Enter");

  await expect(composer).toHaveValue("Retry after snapshot refresh");
  await expect(page.getByRole("button", { name: "保存" })).toBeEnabled();
  await composer.press("Control+Enter");
  await expect(
    page
      .locator(".diff-review-sidebar")
      .getByText("Retry after snapshot refresh"),
  ).toBeVisible();
});

test("actual Appでactive change未選択のEditorは先頭から表示する", async ({
  page,
}) => {
  await openRepositoryFile(page);
  await page.getByRole("radio", { name: "Editor" }).click();

  await expect
    .poll(() =>
      page
        .locator(".current-file-viewer__scroll-surface")
        .evaluate((element) => element.scrollTop),
    )
    .toBe(0);
});

test("actual AppでstaleTarget・overflow・indicator-card・keyboard/themeを表現する", async ({
  page,
}) => {
  await openRepositoryFile(page);
  await expectNoSeriousAccessibilityViolations(page);
  await openComposer(page, "current", 2);
  const composer = page.getByRole("textbox", { name: /2行目へのコメント/ });
  await composer.fill("stale draft");
  await page.evaluate(() => localStorage.setItem("e2e-new-snapshot", "true"));
  await page.getByRole("button", { name: "現在の表示を再読み込み" }).click();
  await expect(page.getByRole("button", { name: "保存" })).toBeDisabled();
  await expect(page.getByRole("alert")).toContainText("再アンカー");
  await page.getByRole("button", { name: "再アンカー" }).click();
  await expect(page.getByRole("button", { name: "保存" })).toBeEnabled();
  await page.getByRole("button", { name: "キャンセル" }).click();

  await page.evaluate(() => localStorage.setItem("e2e-overflow-once", "true"));
  await openComposer(page, "current", 2);
  const overflowComposer = page.getByRole("textbox", {
    name: /2行目へのコメント/,
  });
  await overflowComposer.fill("overflow draft");
  await overflowComposer.press("Control+Enter");
  await expect(page.getByRole("button", { name: "保存" })).toBeDisabled();
  await expect(page.getByRole("alert")).toContainText("revision上限");
  await page.getByRole("button", { name: "キャンセル" }).click();

  await page.getByLabel("テーマモード").selectOption("dark");
  await expectNoSeriousAccessibilityViolations(page);
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByRole("radio", { name: "Unified" }).press("ArrowRight");
  await expect(page.getByRole("radio", { name: "Split" })).toBeFocused();
});

test("actual AppでEnter Esc IMEとbase draftのEditor hide/Unified restoreを保つ", async ({
  page,
}) => {
  await openRepositoryFile(page);
  const origin = page.getByRole("button", {
    name: /old-plan\.md base 2行目にコメントを追加/,
  });
  await origin.click();
  const composer = page.getByRole("textbox", { name: /2行目へのコメント/ });
  await composer.fill("first");
  await composer.press("Enter");
  await expect(composer).toHaveValue("first\n");

  await composer.evaluate((element) => {
    element.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Enter",
        ctrlKey: true,
        isComposing: true,
        bubbles: true,
      }),
    );
    element.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Escape",
        isComposing: true,
        bubbles: true,
      }),
    );
  });
  await expect(composer).toBeVisible();
  await expect(page.locator("article[data-comment-id]")).toHaveCount(0);

  await page.getByRole("radio", { name: "Editor" }).click();
  await expect(composer).toBeHidden();
  await page.getByRole("radio", { name: "Unified" }).click();
  await expect(composer).toHaveValue("first\n");
  await composer.press("Escape");
  await expect(composer).toBeHidden();
  await expect(origin).toBeFocused();
});

test("actual Appでpending A-B-A settlementをorigin identityへ隔離する", async ({
  page,
}) => {
  await openRepositoryFile(page);
  await page.evaluate(() =>
    localStorage.setItem("e2e-delay-save-once", "true"),
  );
  await openComposer(page, "current", 2);
  const composer = page.getByRole("textbox", { name: /2行目へのコメント/ });
  await composer.fill("pending A only");
  await composer.press("Control+Enter");

  await openWorkspace(page, "/workspace/worktree-b");
  await openRepositoryFile(page);
  await expect(
    page.locator(".diff-review-sidebar").getByText("pending A only"),
  ).toBeHidden();
  await page.waitForTimeout(350);
  await expect(
    page.locator(".diff-review-sidebar").getByText("pending A only"),
  ).toBeHidden();

  await openWorkspace(page, "/workspace/worktree-a");
  await openRepositoryFile(page);
  await expect(
    page.locator(".diff-review-sidebar").getByText("pending A only"),
  ).toBeVisible();
});

test("actual Appでpermission recoveryとcommitted uncertaintyを区別する", async ({
  page,
}) => {
  await openRepositoryFile(page);
  await page.evaluate(() =>
    localStorage.setItem("e2e-permission-once", "true"),
  );
  await openComposer(page, "current", 2);
  const composer = page.getByRole("textbox", { name: /2行目へのコメント/ });
  await composer.fill("copyable permission draft");
  await composer.press("Control+Enter");
  await expect(composer).toHaveValue("copyable permission draft");
  await expect(page.getByRole("button", { name: "保存" })).toBeDisabled();
  await expect(page.getByRole("alert")).toContainText("権限");
  await expect(page.getByRole("button", { name: "保存を再試行" })).toBeHidden();
  await page.getByRole("button", { name: "キャンセル" }).click();
  await page.getByRole("button", { name: "Diff commentsを再読み込み" }).click();
  await expect(
    page.getByRole("button", { name: "Diff commentsを再読み込み" }),
  ).toBeEnabled();

  await page.evaluate(() => localStorage.setItem("e2e-uncertain-once", "true"));
  await openComposer(page, "current", 2);
  const uncertainComposer = page.getByRole("textbox", {
    name: /2行目へのコメント/,
  });
  await uncertainComposer.fill("committed uncertain");
  await uncertainComposer.press("Control+Enter");
  await expect(
    page.locator(".diff-review-sidebar").getByText("committed uncertain"),
  ).toBeVisible();
  await expect(page.getByText(/永続化の確認が不確実/)).toBeVisible();
  await expect(uncertainComposer).toBeHidden();
  await expect(page.getByRole("button", { name: "保存を再試行" })).toBeHidden();
});

test("actual Appでconvergence pickerがfilter/searchを解除しcardを選択する", async ({
  page,
}) => {
  await seedConvergedComments(page);
  await page.reload();
  await openWorkspace(page, "/workspace/worktree-a");
  await openRepositoryFile(page);
  await page.getByRole("button", { name: "解決済み 1" }).click();
  const search = page.getByRole("searchbox", { name: "コメントを検索" });
  await search.fill("no-match");
  await expect(
    page.getByText("条件に一致するコメントはありません"),
  ).toBeVisible();

  await page
    .getByRole("button", {
      name: "implementation-plan.md current 2行目のコメント2件を選択",
    })
    .click();
  await expect(
    page.getByRole("menuitem", { name: "converged first" }),
  ).toBeFocused();
  await page.getByRole("menuitem", { name: "converged second" }).click();
  await expect(page.getByRole("button", { name: "すべて 3" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(search).toHaveValue("");
  await expect(
    page.locator('[data-comment-id="converged-b"].review-comment__select'),
  ).toHaveAttribute("aria-current", "true");
});
test("actual Appでhidden copy pathのbase/current card jumpを復元する", async ({
  page,
}) => {
  await page.evaluate(() => localStorage.setItem("e2e-hidden-copy", "true"));
  await page.reload();
  await openWorkspace(page, "/workspace/worktree-a");
  await page.getByRole("tab", { name: "Diff" }).click();
  const directory = page.getByRole("treeitem").filter({
    has: page.locator(".repository-diff-tree__name", {
      hasText: /^reviews$/,
    }),
  });
  await directory.click();
  await page.getByRole("treeitem").filter({ hasText: "copy-plan.md" }).click();

  await openComposer(page, "base", 2, "old-copy");
  let composer = page.getByRole("textbox", { name: /base 2行目へのコメント/ });
  await composer.fill("hidden copy base");
  await composer.press("Control+Enter");
  await openComposer(page, "current", 2, "reviews/copy-plan");
  composer = page.getByRole("textbox", { name: /current 2行目へのコメント/ });
  await composer.fill("hidden copy current");
  await composer.press("Control+Enter");

  await directory.click();
  await expect(
    page.getByRole("treeitem").filter({ hasText: "copy-plan.md" }),
  ).toBeHidden();
  await page
    .getByRole("button", { name: /old-copy\.md base 2行目へ移動/ })
    .click();
  await expect(
    page.getByRole("button", {
      name: /old-copy\.md base 2行目のコメントを選択/,
    }),
  ).toHaveAttribute("aria-current", "true");
  await page
    .getByRole("button", {
      name: /reviews\/copy-plan\.md current 2行目へ移動/,
    })
    .click();
  await expect(
    page.getByRole("button", {
      name: /reviews\/copy-plan\.md current 2行目のコメントを選択/,
    }),
  ).toHaveAttribute("aria-current", "true");
});
test("actual AppでAll unchanged current lineをsave reload jumpする", async ({
  page,
}) => {
  await page.getByRole("tab", { name: "Diff" }).click();
  await page.getByRole("tab", { name: "All" }).click();
  await page.getByRole("treeitem").filter({ hasText: "notes.md" }).click();
  await page.getByRole("radio", { name: "Editor" }).click();
  await openComposer(page, "current", 2, "notes");
  const composer = page.getByRole("textbox", { name: /2行目へのコメント/ });
  await composer.fill("unchanged All persisted");
  await composer.press("Control+Enter");
  await expect(
    page.locator(".diff-review-sidebar").getByText("unchanged All persisted"),
  ).toBeVisible();

  await page.reload();
  await openWorkspace(page, "/workspace/worktree-a");
  await page.getByRole("tab", { name: "Diff" }).click();
  await page.getByRole("tab", { name: "All" }).click();
  await expect(
    page.locator(".diff-review-sidebar").getByText("unchanged All persisted"),
  ).toBeVisible();
  await page
    .getByRole("button", { name: /notes\.md current 2行目へ移動/ })
    .click();
  await expect(page.getByRole("tab", { name: /notes\.md/ })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(
    page.getByRole("button", {
      name: "notes.md current 2行目のコメント1件を表示",
    }),
  ).toHaveAttribute("aria-current", "true");
});

test("actual AppでstoreBusyとioはdraftを保持してretryできinvalidStoreは恒久blockする", async ({
  page,
}) => {
  await openRepositoryFile(page);
  for (const scenario of [
    { failure: "storeBusy" as const, side: "current" as const, line: 2 },
    { failure: "io" as const, side: "base" as const, line: 2 },
  ]) {
    await page.evaluate(
      (code) => localStorage.setItem(`e2e-${code}-once`, "true"),
      scenario.failure,
    );
    await openComposer(page, scenario.side, scenario.line);
    const composer = page.getByRole("textbox", {
      name: new RegExp(`${scenario.side} ${scenario.line}行目へのコメント`),
    });
    await composer.fill(`${scenario.failure} retry body`);
    await composer.press("Control+Enter");
    await expect(composer).toHaveValue(`${scenario.failure} retry body`);
    await expect(
      page.getByRole("button", { name: "保存を再試行" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "保存を再試行" }).click();
    await expect(
      page
        .locator(".diff-review-sidebar")
        .getByText(`${scenario.failure} retry body`),
    ).toBeVisible();
  }

  await page.evaluate(() =>
    localStorage.setItem("e2e-invalidStore-once", "true"),
  );
  await openComposer(page, "current", 1);
  const invalidComposer = page.getByRole("textbox", {
    name: /current 1行目へのコメント/,
  });
  await invalidComposer.fill("invalid store body");
  await invalidComposer.press("Control+Enter");
  await expect(invalidComposer).toHaveValue("invalid store body");
  await expect(page.getByRole("button", { name: "保存" })).toBeDisabled();
  await invalidComposer.press("Escape");
  await openComposer(page, "current", 3);
  await expect(page.getByRole("button", { name: "保存" })).toBeDisabled();
});

test("actual Appでrelocatedだけjump可能、staleは非jumpでexport操作を公開しない", async ({
  page,
}) => {
  await page.evaluate(() =>
    localStorage.setItem("e2e-resolution-cards", "true"),
  );
  await page.reload();
  await openWorkspace(page, "/workspace/worktree-a");
  await openRepositoryFile(page);

  await expect(
    page.locator(".diff-review-sidebar").getByText("relocated body"),
  ).toBeVisible();
  await page
    .getByRole("button", {
      name: /implementation-plan\.md current 2行目へ移動/,
    })
    .click();
  await expect(
    page.getByRole("button", {
      name: "implementation-plan.md current 2行目のコメント1件を表示",
    }),
  ).toBeFocused();
  await expect(
    page.getByRole("button", {
      name: /implementation-plan\.md current 3行目へ移動/,
    }),
  ).toBeDisabled();
  await expect(page.getByRole("button", { name: /export/i })).toHaveCount(0);
  await expect(page.getByRole("link", { name: /export/i })).toHaveCount(0);
});

test("actual Appでfoldedかつwindow外のtargetを展開してfocusする", async ({
  page,
}) => {
  await page.evaluate(() => localStorage.setItem("e2e-folded-target", "true"));
  await page.reload();
  await openWorkspace(page, "/workspace/worktree-a");
  await openRepositoryFile(page);
  await page
    .getByRole("button", {
      name: /implementation-plan\.md current 150行目へ移動/,
    })
    .click();

  await expect(
    page.getByRole("button", {
      name: "implementation-plan.md current 150行目のコメント1件を表示",
    }),
  ).toBeFocused();
  await expect(page.getByRole("row", { name: /省略/ })).toHaveCount(0);
});

test("actual Appでsnapshot stale draftをdiscardできる", async ({ page }) => {
  await openRepositoryFile(page);
  await openComposer(page, "current", 2);
  const composer = page.getByRole("textbox", { name: /2行目へのコメント/ });
  await composer.fill("discard stale body");
  await page.evaluate(() => localStorage.setItem("e2e-new-snapshot", "true"));
  await page.getByRole("button", { name: "現在の表示を再読み込み" }).click();
  await expect(page.getByRole("button", { name: "保存" })).toBeDisabled();
  await page.getByRole("button", { name: "キャンセル" }).click();
  await expect(composer).toBeHidden();
});
test("actual AppでDiffコメントを確認後に削除する", async ({ page }) => {
  await openRepositoryFile(page);
  await openComposer(page, "current", 2);
  const composer = page.getByRole("textbox", { name: /2行目へのコメント/ });
  await composer.fill("delete this comment");
  await composer.press("Control+Enter");
  await expect(
    page.locator(".diff-review-sidebar").getByText("delete this comment"),
  ).toBeVisible();

  await page.getByRole("button", { name: /^削除 comment-/ }).click();
  await page
    .getByRole("button", { name: /^コメント削除を確定 comment-/ })
    .click();

  await expect(
    page.locator(".diff-review-sidebar").getByText("delete this comment"),
  ).toBeHidden();
  await expect(page.locator("article[data-comment-id]")).toHaveCount(0);
});
