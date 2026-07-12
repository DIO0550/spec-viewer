import { act, useLayoutEffect } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";
import type { UserReviewTarget } from "@/features/review-runs/domain/userReviewTarget";
import { useCreateUserReview } from "@/features/review-runs/hooks/useCreateUserReview";
import type { UserReview } from "@/features/review-runs/types/userReviewIpc";
import type { UserReviewCommands } from "@/shared/api/tauri";
import { CommentId } from "@/shared/domain/commentId";
import {
  SelectionIdentity,
  SpecViewSelection,
} from "@/shared/domain/specViewSelection";
import { WorkspacePath } from "@/shared/domain/workspacePath";

/** @returns Branded identity generated through the selection aggregate. */
function createSelectionIdentity(seed: string): SelectionIdentity {
  const selection = SpecViewSelection.synchronize(SpecViewSelection.empty(), {
    workspacePath: WorkspacePath.fromString(seed),
    specId: "auth",
    fileKey: "tasks",
  });

  return SelectionIdentity.fromSelection(selection);
}

type HookResult<Props, Result> = Readonly<{
  current: Result;
  rerender: (nextProps: Props) => void;
  rerenderBeforePassiveEffects: (
    nextProps: Props,
    beforePassiveEffects: () => void,
  ) => Promise<void>;
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
  const commitCallbacks: Array<() => void> = [];

  function TestComponent(): null {
    result.current = hook(props.current);
    useLayoutEffect(() => {
      commitCallbacks.shift()?.();
    });
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
    rerenderBeforePassiveEffects: (
      nextProps: Props,
      beforePassiveEffects: () => void,
    ) => {
      props.current = nextProps;
      return new Promise<void>((resolve) => {
        commitCallbacks.push(() => {
          beforePassiveEffects();
          resolve();
        });
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

function renderUseCreateUserReview(props: HookProps) {
  return renderHook(
    ({ commands, onUserReviewEvent, selectionId, workspacePath }) =>
      useCreateUserReview({
        commands,
        workspacePath: WorkspacePath.fromString(workspacePath),
        target,
        selectionIdentity: createSelectionIdentity(selectionId),
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

const secondActiveRun: UserReview = {
  ...activeRun,
  id: "review-second-active",
};

function createCommands(): UserReviewCommands {
  return {
    listUserReviews: vi.fn(),
    createUserReview: vi.fn().mockResolvedValue({ userReview: activeRun }),
    archiveUserReview: vi.fn(),
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

test("useCreateUserReviewはcreate成功後にreviewCreated eventを発行する", async () => {
  const commands = createCommands();
  const onUserReviewEvent = vi.fn();
  const result = renderUseCreateUserReview({
    commands,
    workspacePath: "/workspace/spec-reviewer",
    selectionId: "/workspace/spec-reviewer:file:auth:tasks",
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
    selectionIdentity: createSelectionIdentity(
      "/workspace/spec-reviewer:file:auth:tasks",
    ),
    event: {
      type: "reviewCreated",
      review: activeRun,
    },
  });
  result.unmount();
});

test("useCreateUserReviewはselectionIdを戻しても古いsuccessを再表示しない", async () => {
  const commands = createCommands();
  const onUserReviewEvent = vi.fn();
  const result = renderUseCreateUserReview({
    commands,
    workspacePath: "/workspace/spec-reviewer",
    selectionId: "/workspace/spec-reviewer:file:auth:tasks",
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
    selectionId: "/workspace/other:file:auth:tasks",
    onUserReviewEvent,
  });
  result.rerender({
    commands,
    workspacePath: "/workspace/spec-reviewer",
    selectionId: "/workspace/spec-reviewer:file:auth:tasks",
    onUserReviewEvent,
  });

  expect(result.current.createState.status).toBe("idle");
  result.unmount();
});

test("useCreateUserReviewは同一identityの古いcreate完了を反映しない", async () => {
  const firstCreate = createDeferred<{ userReview: UserReview }>();
  const commands: UserReviewCommands = {
    listUserReviews: vi.fn(),
    createUserReview: vi
      .fn()
      .mockReturnValueOnce(firstCreate.promise)
      .mockResolvedValueOnce({ userReview: secondActiveRun }),
    archiveUserReview: vi.fn(),
  };
  const onUserReviewEvent = vi.fn();
  const result = renderUseCreateUserReview({
    commands,
    workspacePath: "/workspace/spec-reviewer",
    selectionId: "/workspace/spec-reviewer:file:auth:tasks",
    onUserReviewEvent,
  });

  const firstPromise = result.current.createUserReview({
    commentIds: [CommentId.fromString("cmt_1")],
    workspaceMode: "currentWorkspace",
  });
  await act(async () => {
    await result.current.createUserReview({
      commentIds: [CommentId.fromString("cmt_2")],
      workspaceMode: "currentWorkspace",
    });
  });
  await act(async () => {
    firstCreate.resolve({ userReview: activeRun });
    await firstPromise;
  });

  expect(result.current.createState).toMatchObject({
    status: "success",
    result: secondActiveRun,
  });
  expect(onUserReviewEvent).toHaveBeenCalledTimes(1);
  expect(onUserReviewEvent).toHaveBeenCalledWith({
    selectionIdentity: createSelectionIdentity(
      "/workspace/spec-reviewer:file:auth:tasks",
    ),
    event: {
      type: "reviewCreated",
      review: secondActiveRun,
    },
  });
  result.unmount();
});

test("selection変更renderのpassive effect前にcreateが完了してもeventを発行しない", async () => {
  const pendingCreate = createDeferred<{ userReview: UserReview }>();
  const commands: UserReviewCommands = {
    listUserReviews: vi.fn(),
    createUserReview: vi.fn().mockReturnValue(pendingCreate.promise),
    archiveUserReview: vi.fn(),
  };
  const onUserReviewEvent = vi.fn();
  const result = renderUseCreateUserReview({
    commands,
    workspacePath: "/workspace/spec-reviewer",
    selectionId: "/workspace/spec-reviewer:file:auth:tasks",
    onUserReviewEvent,
  });
  const createPromise = result.current.createUserReview({
    commentIds: [CommentId.fromString("cmt_1")],
    workspaceMode: "currentWorkspace",
  });

  await result.rerenderBeforePassiveEffects(
    {
      commands,
      workspacePath: "/workspace/other",
      selectionId: "/workspace/other:file:auth:tasks",
      onUserReviewEvent,
    },
    () => {
      pendingCreate.resolve({ userReview: activeRun });
    },
  );
  await createPromise;

  expect(onUserReviewEvent).not.toHaveBeenCalled();
  result.unmount();
});
