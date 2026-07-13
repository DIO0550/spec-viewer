import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";

import { CommentId } from "@/features/comments/types/comment";
import { UserReviewPanel } from "@/features/review-runs/components/UserReviewPanel";
import type { ActiveUserReview } from "@/features/review-runs/domain/userReview";
import type {
  UserReviewArchiveState,
  UserReviewCreateState,
  UserReviewListState,
} from "@/features/review-runs/hooks/useUserReviews";

const activeReview: ActiveUserReview = {
  schemaVersion: "spec-reviewer.user-review.v1",
  id: "urv_0123456789abcdef0123456789abcdef",
  status: "active",
  target: {
    scope: "file",
    specId: "auth",
    fileKey: "tasks",
  },
  recordLocator: "urv_0123456789abcdef0123456789abcdef.json",
  commentCount: 2,
  createdAt: "2026-07-12T10:00:00Z",
  updatedAt: "2026-07-12T10:00:00Z",
  archivedAt: null,
};
const secondActiveReview: ActiveUserReview = {
  ...activeReview,
  id: "urv_abcdef0123456789abcdef0123456789",
  recordLocator: "urv_abcdef0123456789abcdef0123456789.json",
};

type RenderResult = Readonly<{
  container: HTMLDivElement;
  unmount: () => void;
}>;

/**
 * @param component - React component to render into a disposable DOM container.
 * @returns Rendered container and cleanup callback.
 */
function renderComponent(component: ReactNode): RenderResult {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);

  act(() => {
    root.render(component);
  });

  return {
    container,
    unmount: () => {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
}

/**
 * @param options - State and callbacks that override the default active-review panel.
 * @returns Rendered user review panel.
 */
function renderPanel(
  options: Readonly<{
    openCommentCount?: number;
    canCreateUserReview?: boolean;
    listState?: UserReviewListState;
    createState?: UserReviewCreateState;
    archiveState?: UserReviewArchiveState;
    onCreateUserReview?: () => void;
    onArchiveUserReview?: (userReview: ActiveUserReview) => void;
  }> = {},
): RenderResult {
  return renderComponent(
    <UserReviewPanel
      targetScope="file"
      openCommentCount={options.openCommentCount ?? 2}
      canCreateUserReview={options.canCreateUserReview ?? true}
      listState={
        options.listState ?? {
          status: "ready",
          target: activeReview.target,
          active: [activeReview],
          archived: [],
          problems: [],
          error: null,
        }
      }
      createState={options.createState ?? { status: "idle" }}
      archiveState={options.archiveState ?? { status: "idle" }}
      onTargetScopeChange={vi.fn()}
      onCreateUserReview={options.onCreateUserReview ?? vi.fn()}
      onArchiveUserReview={options.onArchiveUserReview ?? vi.fn()}
      onRefreshUserReviews={vi.fn()}
    />,
  );
}

test("UserReviewPanelはdomainが作成不可と判定すると作成をdisabledにする", () => {
  const result = renderPanel({
    canCreateUserReview: false,
    openCommentCount: 0,
  });
  const createButton = result.container.querySelector(
    ".review-run-panel__create",
  ) as HTMLButtonElement;

  expect(createButton.disabled).toBe(true);
  expect(result.container.textContent).toContain(
    "未解決コメントはありません。",
  );
  result.unmount();
});

test("UserReviewPanelは作成中に作成ボタンをdisabledにする", () => {
  const result = renderPanel({
    createState: {
      status: "saving",
      payload: { commentIds: [CommentId.fromString("cmt_1")] },
    },
  });
  const createButton = result.container.querySelector(
    ".review-run-panel__create",
  ) as HTMLButtonElement;

  expect(createButton.disabled).toBe(true);
  expect(createButton.textContent).toContain("作成中");
  result.unmount();
});

test("UserReviewPanelは作成エラーを日本語alertで表示する", () => {
  const result = renderPanel({
    createState: {
      status: "error",
      payload: { commentIds: [CommentId.fromString("cmt_1")] },
      error: {
        code: "userReviewExport",
        message: "failed to write user review record",
        raw: {},
      },
    },
  });

  expect(result.container.querySelector('[role="alert"]')?.textContent).toBe(
    "レビューを作成できませんでした。failed to write user review record",
  );
  result.unmount();
});

test("UserReviewPanelはrecord locatorとcomment countだけでactive reviewを表示する", () => {
  const result = renderPanel();

  expect(result.container.textContent).toContain(activeReview.recordLocator);
  expect(result.container.textContent).toContain("コメント 2件");
  expect(result.container.textContent).not.toContain("作成先");
  expect(result.container.textContent).not.toContain("Worktree");
  expect(
    result.container.querySelector('[aria-label="対象ファイル"]'),
  ).toBeNull();
  result.unmount();
});

test("UserReviewPanelはdomainでarchive可能なactive reviewを確認後にアーカイブする", async () => {
  const onArchiveUserReview = vi.fn();
  const confirmMock = vi.fn(() => true);
  vi.stubGlobal("confirm", confirmMock);
  const result = renderPanel({ onArchiveUserReview });
  const archiveButton = result.container.querySelector(
    `[aria-label="${activeReview.id}をアーカイブ"]`,
  ) as HTMLButtonElement;

  await act(async () => {
    archiveButton.click();
  });

  expect(archiveButton.disabled).toBe(false);
  expect(confirmMock).toHaveBeenCalled();
  expect(onArchiveUserReview).toHaveBeenCalledWith(activeReview);
  result.unmount();
  vi.unstubAllGlobals();
});

test("UserReviewPanelはアーカイブ保存中に全レビュー行のarchiveをdisabledにする", () => {
  const result = renderPanel({
    listState: {
      status: "ready",
      target: activeReview.target,
      active: [activeReview, secondActiveReview],
      archived: [],
      problems: [],
      error: null,
    },
    archiveState: {
      status: "saving",
      payload: { userReviewId: activeReview.id },
    },
  });
  const archiveButtons = result.container.querySelectorAll<HTMLButtonElement>(
    '[aria-label$="をアーカイブ"]',
  );

  expect(archiveButtons).toHaveLength(2);
  expect([...archiveButtons].map((button) => button.disabled)).toEqual([
    true,
    true,
  ]);
  expect([...archiveButtons].map((button) => button.textContent)).toEqual([
    "アーカイブ中",
    "アーカイブ中",
  ]);
  result.unmount();
});

test("UserReviewPanelはrecord problemのlocatorと日本語説明を表示する", () => {
  const result = renderPanel({
    listState: {
      status: "empty",
      target: activeReview.target,
      active: [],
      archived: [],
      problems: [
        {
          locator: "legacy-review-folder",
          kind: "legacyRecord",
          message: "legacy folder bundle",
        },
      ],
      error: null,
    },
  });

  expect(result.container.querySelector('[role="alert"]')?.textContent).toBe(
    "旧形式のレビュー: legacy-review-folder フォルダ形式のレビューは一覧に表示できません。",
  );
  expect(result.container.textContent).not.toContain("legacy folder bundle");
  result.unmount();
});
