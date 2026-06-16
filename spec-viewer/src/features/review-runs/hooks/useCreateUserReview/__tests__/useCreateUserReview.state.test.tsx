import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";

import { CommentId } from "@/features/comments/types/comment";
import type { UserReviewTarget } from "@/features/review-runs/domain/userReviewTarget";
import { useCreateUserReview } from "@/features/review-runs/hooks/useCreateUserReview";
import type { UserReview } from "@/features/review-runs/types/userReviewIpc";
import type { UserReviewCommands } from "@/shared/api/tauri";
import { WorkspacePath } from "@/shared/domain/workspacePath";

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
  viewIdentity: string;
  commands: UserReviewCommands;
  onUserReviewEvent: (event: unknown) => void;
}>;

function renderUseCreateUserReview(props: HookProps) {
  return renderHook(
    ({ commands, onUserReviewEvent, viewIdentity, workspacePath }) =>
      useCreateUserReview({
        commands,
        workspacePath: WorkspacePath.fromString(workspacePath),
        target,
        viewIdentity,
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

const activeRun: UserReview = {
  id: "review-active",
  status: "active",
  target,
  workspace: {
    mode: "currentWorkspace",
    workspacePath: "/workspace/spec-reviewer",
  },
  specFolderPath: "/workspace/spec-reviewer/.plugin-workspace/.specs/auth",
  folderPath:
    "/workspace/spec-reviewer/.plugin-workspace/.specs/auth/user-review/active/review-active",
  sourceFiles: [
    {
      specId: "auth",
      fileKey: "tasks",
      relativePath: ".plugin-workspace/.specs/auth/tasks.md",
    },
  ],
  commentCount: 1,
  createdAt: "2026-05-06T12:00:00Z",
  archivedAt: null,
  summary: null,
  warnings: [],
};

function createCommands(): UserReviewCommands {
  return {
    listUserReviews: vi.fn(),
    createUserReview: vi.fn().mockResolvedValue({ userReview: activeRun }),
    archiveUserReview: vi.fn(),
  };
}

test("useCreateUserReviewはcreate成功後にreviewCreated eventを発行する", async () => {
  const commands = createCommands();
  const onUserReviewEvent = vi.fn();
  const result = renderUseCreateUserReview({
    commands,
    workspacePath: "/workspace/spec-reviewer",
    viewIdentity: "/workspace/spec-reviewer:file:auth:tasks",
    onUserReviewEvent,
  });

  await act(async () => {
    await result.current.createUserReview({
      commentIds: [CommentId.fromString("cmt_1")],
      workspaceMode: "currentWorkspace",
    });
  });

  expect(result.current.createState.status).toBe("success");
  expect(onUserReviewEvent).toHaveBeenCalledWith({
    identity: "/workspace/spec-reviewer:file:auth:tasks",
    event: {
      type: "reviewCreated",
      review: activeRun,
    },
  });
  result.unmount();
});


test("useCreateUserReviewはviewIdentityを戻しても古いsuccessを再表示しない", async () => {
  const commands = createCommands();
  const onUserReviewEvent = vi.fn();
  const result = renderUseCreateUserReview({
    commands,
    workspacePath: "/workspace/spec-reviewer",
    viewIdentity: "/workspace/spec-reviewer:file:auth:tasks",
    onUserReviewEvent,
  });

  await act(async () => {
    await result.current.createUserReview({
      commentIds: [CommentId.fromString("cmt_1")],
      workspaceMode: "currentWorkspace",
    });
  });
  result.rerender({
    commands,
    workspacePath: "/workspace/other",
    viewIdentity: "/workspace/other:file:auth:tasks",
    onUserReviewEvent,
  });
  result.rerender({
    commands,
    workspacePath: "/workspace/spec-reviewer",
    viewIdentity: "/workspace/spec-reviewer:file:auth:tasks",
    onUserReviewEvent,
  });

  expect(result.current.createState.status).toBe("idle");
  result.unmount();
});
