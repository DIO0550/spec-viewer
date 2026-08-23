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
test("Diff Reviewはicon再読み込みと削除確認を表示する", async ({ page }) => {
  await page.goto(
    "/iframe.html?id=features-diffcomments-components-diffreviewsidebar--all-props&viewMode=story",
  );

  await expect(
    page.getByRole("button", { name: "コメントを再読み込み" }),
  ).toBeVisible();
  await expect(page.locator(".diff-review-sidebar__title h2")).toHaveCSS(
    "font-size",
    "16px",
  );
  await expect(
    page.locator(".diff-review-card .review-comment__body").first(),
  ).toHaveCSS("font-size", "16px");
  await expect(page.getByRole("button", { name: /^未解決/ })).toHaveCSS(
    "font-size",
    "13px",
  );
  const exactCard = page.locator("article[data-comment-id='exact']");
  await page.getByRole("button", { name: "削除 exact" }).click();
  await expect(
    page.getByRole("button", { name: "コメント削除を確定 exact" }),
  ).toBeVisible();
  await expect(exactCard.locator(".diff-review-card__actions")).toHaveCount(0);
  await expect(
    exactCard.locator(".review-comment__delete-confirmation"),
  ).toHaveCSS("display", "grid");
  await expect(
    page.getByRole("button", { name: "削除をキャンセル exact" }),
  ).toBeVisible();
});

test("Diff Reviewは返信を表示し解決済みcardを手動展開できる", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 900 });
  await page.goto(
    "/iframe.html?id=features-diffcomments-components-diffreviewsidebar--all-props&viewMode=story",
  );

  await expect(
    page.getByText("確認しました。nullのときは早期returnにします。"),
  ).toBeVisible();
  const exactCard = page.locator("article[data-comment-id='exact']");
  const contentOverflow = await exactCard.evaluate((card) => {
    const cardBounds = card.getBoundingClientRect();
    const contentBounds = card
      .querySelector(".review-comment__content")
      ?.getBoundingClientRect();
    return {
      left: (contentBounds?.left ?? 0) < cardBounds.left,
      right: (contentBounds?.right ?? 0) > cardBounds.right,
    };
  });
  expect(contentOverflow).toEqual({ left: false, right: false });

  const resolvedCard = page.locator("article[data-comment-id='stale']");
  await expect(
    resolvedCard.getByText("削除理由を文書化してください"),
  ).not.toBeVisible();
  await page.getByRole("button", { name: "コメントを展開 stale" }).click();
  await expect(
    resolvedCard.getByText("削除理由を文書化してください"),
  ).toBeVisible();

  const replyEditor = page.getByRole("textbox", { name: "返信本文 exact" });
  await replyEditor.fill("追加の確認です");
  await page.getByRole("button", { name: "返信を送信 exact" }).click();
  await expect(replyEditor).toHaveValue("");
});

test("Diff行の未解決コメントを常時見えるマーカーで表示する", async ({
  page,
}) => {
  await page.goto(
    "/iframe.html?id=features-diffcomments-components-difflinecommentcontrol--all-props&viewMode=story",
  );

  const marker = page.getByRole("button", {
    name: "src/parser.ts current 42行目のコメント1件を表示",
  });
  await expect(marker).toBeVisible();
  await expect(marker).toHaveAttribute(
    "title",
    "src/parser.ts current 42行目・未解決コメント1件",
  );
  await expect(marker).toHaveCSS("min-width", "32px");
  await expect(marker).toHaveCSS("height", "26px");
  await expect(marker.locator("svg")).toHaveAttribute("width", "14");
});

test("未解決コメント本文はDiff行に残り16pxで表示する", async ({ page }) => {
  await page.goto(
    storyUrl("diff-comments-viewerintegration--converged-comments"),
  );

  const firstComment = page.locator(".diff-inline-comment-thread__comment", {
    hasText: "First",
  });
  await expect(firstComment).toBeVisible();
  await expect(firstComment).toHaveCSS("font-size", "16px");
  const placement = await firstComment.evaluate((element) => {
    const thread = element.closest(".diff-inline-comment-thread");
    const cell = thread?.parentElement;
    const code = cell?.querySelector(":scope > code");
    return {
      isDirectCellChild: cell?.classList.contains("diff-viewer__cell"),
      threadTop: thread?.getBoundingClientRect().top ?? 0,
      codeBottom: code?.getBoundingClientRect().bottom ?? Infinity,
    };
  });
  expect(placement.isDirectCellChild).toBe(true);
  expect(placement.threadTop).toBeGreaterThanOrEqual(placement.codeBottom);
});

for (const storyId of [
  "diff-comments-viewerintegration--unified-comments",
  "diff-comments-viewerintegration--editor-comments",
] as const) {
  test(`${storyId}のコメント入力欄は表示領域の左端からはみ出さない`, async ({
    page,
  }) => {
    await page.goto(storyUrl(storyId));

    const composer = page.locator(".diff-comment-composer");
    await expect(composer).toBeVisible();
    await expect(
      composer.locator("xpath=..").locator(".diff-line-comment-control"),
    ).toBeHidden();
    await expect(composer).toHaveCSS("width", "640px");
    await expect(composer.locator("textarea")).toHaveCSS("min-height", "160px");
    const bounds = await composer.evaluate((element) => {
      const composerBounds = element.getBoundingClientRect();
      const surface = element.closest(
        ".diff-viewer__scroll-surface, .current-file-viewer__scroll-surface",
      );
      const surfaceBounds = surface?.getBoundingClientRect();
      return {
        composerLeft: composerBounds.left,
        surfaceLeft: surfaceBounds?.left ?? Number.POSITIVE_INFINITY,
      };
    });

    expect(bounds.composerLeft).toBeGreaterThanOrEqual(bounds.surfaceLeft);
  });
}

test("変更ファイルのloadingは文言を表示せずskeletonを表示する", async ({
  page,
}) => {
  await page.goto(
    "/iframe.html?id=features-repositorydiff-components-repositorydifftree--loading&viewMode=story",
  );

  await expect(
    page.getByRole("status", { name: "変更ファイルを読み込んでいます。" }),
  ).toBeVisible();
  await expect(
    page.getByText("変更ファイルを読み込んでいます。"),
  ).not.toBeVisible();
  await expect(page.locator(".loading-skeleton__bar")).toHaveCount(5);
});
