import * as TestValues from "@/shared/testing/validatedValueObjects";
import { act, useLayoutEffect } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";

import type { UserReviewTarget } from "@/features/review-runs/domain/userReviewTarget";
import { useArchiveUserReview } from "@/features/review-runs/hooks/useArchiveUserReview";
import type { UserReview } from "@/features/review-runs/types/userReviewIpc";
import type { UserReviewCommands } from "@/features/review-runs/application/ports/userReviewCommands";
import {
  SelectionIdentity,
  SpecViewSelection,
} from "@/shared/domain/specViewSelection";
import { WorkspacePath } from "@/shared/domain/workspacePath";

/** @returns Branded identity generated through the selection aggregate. */
function createSelectionIdentity(seed: string): SelectionIdentity {
  const selection = SpecViewSelection.synchronize(SpecViewSelection.empty(), {
    workspacePath: WorkspacePath.fromString(seed),
    specId: TestValues.specId("auth"),
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

function renderUseArchiveUserReview(props: HookProps) {
  return renderHook(
    ({ commands, onUserReviewEvent, selectionId, workspacePath }) =>
      useArchiveUserReview({
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
  specId: TestValues.specId("auth"),
  fileKey: "tasks",
};

const archivedRun: UserReview = {
  id: TestValues.userReviewId("urv_00000000000000000000000000000002"),
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
      specId: TestValues.specId("auth"),
      fileKey: "tasks",
      relativePath: ".plugin-workspace/.specs/auth/tasks.md",
    },
  ],
  commentCount: 1,
  createdAt: TestValues.isoDateTime("2026-05-06T12:00:00Z"),
  archivedAt: TestValues.isoDateTime("2026-05-06T12:30:00Z"),
  summary: null,
  warnings: [],
};

const secondArchivedRun: UserReview = {
  ...archivedRun,
  id: TestValues.userReviewId("urv_00000000000000000000000000000006"),
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
    await result.current.archiveUserReview(
      TestValues.userReviewId("urv_00000000000000000000000000000001"),
    );
  });

  expect(result.current.archiveState.status).toBe("success");
  expect(onUserReviewEvent).toHaveBeenCalledWith({
    selectionIdentity: createSelectionIdentity(
      "/workspace/spec-reviewer:file:auth:tasks",
    ),
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
    await result.current.archiveUserReview(
      TestValues.userReviewId("urv_00000000000000000000000000000001"),
    );
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

  const firstPromise = result.current.archiveUserReview(
    TestValues.userReviewId("urv_00000000000000000000000000000001"),
  );
  await act(async () => {
    await result.current.archiveUserReview(
      TestValues.userReviewId("urv_00000000000000000000000000000005"),
    );
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
    selectionIdentity: createSelectionIdentity(
      "/workspace/spec-reviewer:file:auth:tasks",
    ),
    event: {
      type: "reviewArchived",
      review: secondArchivedRun,
    },
  });
  result.unmount();
});

test("selection変更renderのpassive effect前にarchiveが完了してもeventを発行しない", async () => {
  const archiveDeferred = createDeferred<{ userReview: UserReview }>();
  const commands: UserReviewCommands = {
    listUserReviews: vi.fn(),
    createUserReview: vi.fn(),
    archiveUserReview: vi.fn().mockReturnValue(archiveDeferred.promise),
  };
  const onUserReviewEvent = vi.fn();
  const result = renderUseArchiveUserReview({
    commands,
    workspacePath: "/workspace/spec-reviewer",
    selectionId: "/workspace/spec-reviewer:file:auth:tasks",
    onUserReviewEvent,
  });
  const archivePromise = result.current.archiveUserReview(
    TestValues.userReviewId("urv_00000000000000000000000000000001"),
  );

  await result.rerenderBeforePassiveEffects(
    {
      commands,
      workspacePath: "/workspace/other",
      selectionId: "/workspace/other:file:auth:tasks",
      onUserReviewEvent,
    },
    () => {
      archiveDeferred.resolve({ userReview: archivedRun });
    },
  );
  await archivePromise;

  expect(onUserReviewEvent).not.toHaveBeenCalled();
  result.unmount();
});
