import { act } from "react";
import type { ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";

import type {
  ReviewRunCreateState,
  ReviewRunListState,
} from "../hooks/useReviewRuns";
import type { ReviewRun } from "../types/reviewRun";
import { ReviewRunPanel } from "./ReviewRunPanel";

const activeRunBranchName =
  "spec-reviewer/2026-05-06T120000Z-file-tasks-abcdef12";
const activeRunSourcePath = ".plugin-workspace/.specs/auth/tasks.md";

const activeRun: ReviewRun = {
  id: "2026-05-06T120000Z-file-tasks-abcdef12",
  status: "active",
  target: {
    scope: "file",
    specId: "auth",
    fileKey: "tasks",
  },
  executionTarget: {
    mode: "worktree",
    repositoryPath: "/workspace/spec-reviewer",
    worktreePath: "/workspace/spec-reviewer.spec-reviewer-worktrees/auth",
    branchName: activeRunBranchName,
  },
  specFolderPath: "/workspace/spec-reviewer/.plugin-workspace/.specs/auth",
  folderPath:
    "/workspace/spec-reviewer.spec-reviewer-worktrees/auth/.plugin-workspace/.specs/auth/user-review/active/2026-05-06T120000Z-file-tasks-abcdef12",
  sourceFiles: [
    {
      specId: "auth",
      fileKey: "tasks",
      relativePath: activeRunSourcePath,
    },
  ],
  commentCount: 2,
  createdAt: "2026-05-06T12:00:00Z",
  archivedAt: null,
  summary: null,
  warnings: [],
};

type RenderResult = Readonly<{
  container: HTMLDivElement;
  unmount: () => void;
}>;

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

function renderPanel(
  options: Readonly<{
    openCommentCount?: number;
    listState?: ReviewRunListState;
    createState?: ReviewRunCreateState;
    onCreateReviewRun?: () => void;
    onArchiveReviewRun?: (reviewRunId: string) => void;
    onCopyPath?: (path: string) => Promise<void>;
  }> = {},
): RenderResult {
  return renderComponent(
    <ReviewRunPanel
      targetScope="file"
      executionMode="currentWorkspace"
      openCommentCount={options.openCommentCount ?? 2}
      listState={
        options.listState ?? {
          status: "ready",
          target: activeRun.target,
          active: [activeRun],
          archived: [],
          problems: [],
          error: null,
        }
      }
      createState={
        options.createState ?? {
          status: "idle",
          reviewRun: null,
          error: null,
        }
      }
      archiveState={{
        status: "idle",
        reviewRunId: null,
        reviewRun: null,
        error: null,
      }}
      onTargetScopeChange={vi.fn()}
      onExecutionModeChange={vi.fn()}
      onCreateReviewRun={options.onCreateReviewRun ?? vi.fn()}
      onArchiveReviewRun={options.onArchiveReviewRun ?? vi.fn()}
      onRefreshReviewRuns={vi.fn()}
      onCopyPath={options.onCopyPath ?? vi.fn().mockResolvedValue(undefined)}
    />,
  );
}

test("ReviewRunPanelは未解決コメントがないと作成をdisabledにする", () => {
  const result = renderPanel({ openCommentCount: 0 });
  const createButton = result.container.querySelector(
    ".review-run-panel__create",
  ) as HTMLButtonElement;

  expect(createButton.disabled).toBe(true);
  expect(result.container.textContent).toContain(
    "未解決コメントはありません。",
  );
  result.unmount();
});

test("ReviewRunPanelは作成エラーを日本語alertで表示する", () => {
  const result = renderPanel({
    createState: {
      status: "error",
      reviewRun: null,
      error: {
        code: "reviewRunExport",
        message: "source files have uncommitted changes",
        raw: {},
      },
    },
  });

  expect(result.container.querySelector('[role="alert"]')?.textContent).toBe(
    "レビューを作成できませんでした。source files have uncommitted changes",
  );
  result.unmount();
});

test("ReviewRunPanelはactive runのpathとworktree情報を表示してコピーできる", async () => {
  const onCopyPath = vi.fn().mockResolvedValue(undefined);
  const result = renderPanel({ onCopyPath });
  const copyButton = result.container.querySelector(
    `[aria-label="${activeRun.id}のフォルダパスをコピー"]`,
  ) as HTMLButtonElement;

  await act(async () => {
    copyButton.click();
  });

  expect(result.container.textContent).toContain(activeRun.folderPath);
  expect(result.container.textContent).toContain(activeRunSourcePath);
  expect(result.container.textContent).toContain(activeRunBranchName);
  expect(onCopyPath).toHaveBeenCalledWith(activeRun.folderPath);
  expect(result.container.querySelector('[role="status"]')?.textContent).toBe(
    "フォルダパスをコピーしました。",
  );
  result.unmount();
});

test("ReviewRunPanelはcompleted runを確認後にアーカイブできる", async () => {
  const onArchiveReviewRun = vi.fn();
  const confirmMock = vi.fn(() => true);
  vi.stubGlobal("confirm", confirmMock);
  const completedRun: ReviewRun = {
    ...activeRun,
    status: "completed",
    summary: "対応完了",
  };
  const result = renderPanel({
    listState: {
      status: "ready",
      target: activeRun.target,
      active: [completedRun],
      archived: [],
      problems: [],
      error: null,
    },
    onArchiveReviewRun,
  });
  const archiveButton = result.container.querySelector(
    `[aria-label="${completedRun.id}をアーカイブ"]`,
  ) as HTMLButtonElement | null;

  await act(async () => {
    archiveButton?.click();
  });

  expect(confirmMock).toHaveBeenCalled();
  expect(onArchiveReviewRun).toHaveBeenCalledWith(completedRun.id);
  expect(result.container.textContent).toContain("対応完了");
  result.unmount();
  vi.unstubAllGlobals();
});
