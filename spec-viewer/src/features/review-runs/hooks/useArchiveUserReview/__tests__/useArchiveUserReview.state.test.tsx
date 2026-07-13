import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";

import type { UserReviewTarget } from "@/features/review-runs/domain/userReviewTarget";
import { useArchiveUserReview } from "@/features/review-runs/hooks/useArchiveUserReview";
import type { UserReview } from "@/features/review-runs/types/userReviewIpc";
import type { UserReviewCommands } from "@/shared/api/tauri";
import { workspacePathFixture } from "@/features/workspace/testing/workspacePath";

type HookResult<Props, Result> = Readonly<{
  current: Result;
  rerender: (nextProps: Props) => void;
  unmount: () => void;
}>;

function renderHook<Props, Result>(
  hook: (props: Props) => Result,
  initialProps: Props,
): HookResult<Props, Result> {
  const container = document.createElement("div");
  const root = createRoot(container);
  const props = { current: initialProps };
  const result = { current: undefined as Result };

  function TestComponent(): null {
    result.current = hook(props.current);
    return null;
  }

  act(() => {
    root.render(<TestComponent />);
  });

  return {
    get current() {
      return result.current;
    },
    rerender: (nextProps: Props) => {
      props.current = nextProps;
      act(() => {
        root.render(<TestComponent />);
      });
    },
    unmount: () => {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
}

type HookProps = Readonly<{
  workspacePath: string;
  selectionId: string;
  commands: UserReviewCommands;
  onUserReviewEvent: (event: unknown) => void;
}>;

function renderUseArchiveUserReview(props: HookProps) {
  return renderHook(
    ({ commands, onUserReviewEvent, selectionId, workspacePath }) =>
      useArchiveUserReview({
        commands,
        workspacePath: workspacePathFixture(workspacePath),
        target,
        selectionId,
        onUserReviewEvent,
      }),
    props,
  );
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

const secondArchivedRun: UserReview = {
  ...archivedRun,
  id: "review-second-archived",
};

function createCommands(): UserReviewCommands {
  return {
    listUserReviews: vi.fn(),
    createUserReview: vi.fn(),
    archiveUserReview: vi.fn().mockResolvedValue({ userReview: archivedRun }),
  };
}

type Deferred<T> = Readonly<{
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
}>;

function createDeferred<T>(): Deferred<T> {
  let resolve: (value: T) => void = () => undefined;
  let reject: (error: unknown) => void = () => undefined;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return {
    promise,
    resolve,
    reject,
  };
}

test("useArchiveUserReviewはarchive成功後にreviewArchived eventを発行する", async () => {
  const commands = createCommands();
  const onUserReviewEvent = vi.fn();
  const result = renderUseArchiveUserReview({
    commands,
    workspacePath: "/workspace/spec-reviewer",
    selectionId: "/workspace/spec-reviewer:file:auth:tasks",
    onUserReviewEvent,
  });

  await act(async () => {
    await result.current.archiveUserReview("review-active");
  });

  expect(result.current.archiveState.status).toBe("success");
  expect(onUserReviewEvent).toHaveBeenCalledWith({
    selectionId: "/workspace/spec-reviewer:file:auth:tasks",
    event: {
      type: "reviewArchived",
      review: archivedRun,
    },
  });
  result.unmount();
});

test("useArchiveUserReviewはselectionIdを戻しても古いsuccessを再表示しない", async () => {
  const commands = createCommands();
  const onUserReviewEvent = vi.fn();
  const result = renderUseArchiveUserReview({
    commands,
    workspacePath: "/workspace/spec-reviewer",
    selectionId: "/workspace/spec-reviewer:file:auth:tasks",
    onUserReviewEvent,
  });

  await act(async () => {
    await result.current.archiveUserReview("review-active");
  });
  result.rerender({
    commands,
    workspacePath: "/workspace/other",
    selectionId: "/workspace/other:file:auth:tasks",
    onUserReviewEvent,
  });
  result.rerender({
    commands,
    workspacePath: "/workspace/spec-reviewer",
    selectionId: "/workspace/spec-reviewer:file:auth:tasks",
    onUserReviewEvent,
  });

  expect(result.current.archiveState.status).toBe("idle");
  result.unmount();
});

test("useArchiveUserReviewは同一identityの古いarchive完了を反映しない", async () => {
  const firstArchive = createDeferred<{ userReview: UserReview }>();
  const commands: UserReviewCommands = {
    listUserReviews: vi.fn(),
    createUserReview: vi.fn(),
    archiveUserReview: vi
      .fn()
      .mockReturnValueOnce(firstArchive.promise)
      .mockResolvedValueOnce({ userReview: secondArchivedRun }),
  };
  const onUserReviewEvent = vi.fn();
  const result = renderUseArchiveUserReview({
    commands,
    workspacePath: "/workspace/spec-reviewer",
    selectionId: "/workspace/spec-reviewer:file:auth:tasks",
    onUserReviewEvent,
  });

  const firstPromise = result.current.archiveUserReview("review-active");
  await act(async () => {
    await result.current.archiveUserReview("review-second-active");
  });
  await act(async () => {
    firstArchive.resolve({ userReview: archivedRun });
    await firstPromise;
  });

  expect(result.current.archiveState).toMatchObject({
    status: "success",
    result: secondArchivedRun,
  });
  expect(onUserReviewEvent).toHaveBeenCalledTimes(1);
  expect(onUserReviewEvent).toHaveBeenCalledWith({
    selectionId: "/workspace/spec-reviewer:file:auth:tasks",
    event: {
      type: "reviewArchived",
      review: secondArchivedRun,
    },
  });
  result.unmount();
});
