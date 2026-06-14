import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";

import type { UserReviewTarget } from "@/features/review-runs/domain/userReviewTarget";
import { useArchiveUserReview } from "@/features/review-runs/hooks/useArchiveUserReview";
import type { UserReview } from "@/features/review-runs/types/userReviewIpc";
import type { UserReviewCommands } from "@/shared/api/tauri";
import { WorkspacePath } from "@/shared/domain/workspacePath";

type HookResult<Result> = Readonly<{
  current: Result;
  unmount: () => void;
}>;

function renderHook<Result>(hook: () => Result): HookResult<Result> {
  const container = document.createElement("div");
  const root = createRoot(container);
  const result = { current: undefined as Result };

  function TestComponent(): null {
    result.current = hook();
    return null;
  }

  act(() => {
    root.render(<TestComponent />);
  });

  return {
    get current() {
      return result.current;
    },
    unmount: () => {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
}

const target: UserReviewTarget = {
  scope: "file",
  specId: "auth",
  fileKey: "tasks",
};

const archivedRun: UserReview = {
  id: "review-archived",
  status: "archived",
  target,
  workspace: {
    mode: "currentWorkspace",
    workspacePath: "/workspace/spec-reviewer",
  },
  specFolderPath: "/workspace/spec-reviewer/.plugin-workspace/.specs/auth",
  folderPath:
    "/workspace/spec-reviewer/.plugin-workspace/.specs/auth/user-review/archive/review-archived",
  sourceFiles: [
    {
      specId: "auth",
      fileKey: "tasks",
      relativePath: ".plugin-workspace/.specs/auth/tasks.md",
    },
  ],
  commentCount: 1,
  createdAt: "2026-05-06T12:00:00Z",
  archivedAt: "2026-05-06T12:30:00Z",
  summary: null,
  warnings: [],
};

function createCommands(): UserReviewCommands {
  return {
    listUserReviews: vi.fn(),
    createUserReview: vi.fn(),
    archiveUserReview: vi.fn().mockResolvedValue({ userReview: archivedRun }),
  };
}

test("useArchiveUserReviewはarchive成功後にreviewArchived eventを発行する", async () => {
  const commands = createCommands();
  const onUserReviewEvent = vi.fn();
  const result = renderHook(() =>
    useArchiveUserReview({
      commands,
      workspacePath: WorkspacePath.fromString("/workspace/spec-reviewer"),
      target,
      targetIdentity: "file:auth:tasks",
      onUserReviewEvent,
    }),
  );

  await act(async () => {
    await result.current.archiveUserReview("review-active");
  });

  expect(result.current.archiveState.status).toBe("success");
  expect(onUserReviewEvent).toHaveBeenCalledWith({
    type: "reviewArchived",
    review: archivedRun,
  });
  result.unmount();
});
