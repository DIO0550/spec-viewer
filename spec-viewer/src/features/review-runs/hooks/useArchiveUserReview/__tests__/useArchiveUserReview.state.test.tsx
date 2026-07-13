import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";
import type {
  ActiveUserReview,
  ArchivedUserReview,
} from "@/features/review-runs/domain/userReview";
import type { UserReviewTarget } from "@/features/review-runs/domain/userReviewTarget";
import { useArchiveUserReview } from "@/features/review-runs/hooks/useArchiveUserReview";
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

const activeRun: ActiveUserReview = {
  schemaVersion: "spec-reviewer.user-review.v1",
  id: "review-active",
  status: "active",
  target,
  recordLocator: "review-active.json",
  commentCount: 1,
  createdAt: "2026-05-06T12:00:00Z",
  updatedAt: "2026-05-06T12:00:00Z",
  archivedAt: null,
};

const secondActiveRun: ActiveUserReview = {
  ...activeRun,
  id: "review-second-active",
  recordLocator: "review-second-active.json",
};

const archivedRun: ArchivedUserReview = {
  ...activeRun,
  status: "archived",
  updatedAt: "2026-05-06T12:30:00Z",
  archivedAt: "2026-05-06T12:30:00Z",
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
    await result.current.archiveUserReview(activeRun);
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
    await result.current.archiveUserReview(activeRun);
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

test("useArchiveUserReviewは進行中の同時呼び出しを抑止する", async () => {
  const firstArchive = createDeferred<{ userReview: ArchivedUserReview }>();
  const archiveUserReview = vi.fn().mockReturnValue(firstArchive.promise);
  const commands: UserReviewCommands = {
    listUserReviews: vi.fn(),
    createUserReview: vi.fn(),
    archiveUserReview,
  };
  const onUserReviewEvent = vi.fn();
  const result = renderUseArchiveUserReview({
    commands,
    workspacePath: "/workspace/spec-reviewer",
    selectionId: "/workspace/spec-reviewer:file:auth:tasks",
    onUserReviewEvent,
  });

  let firstPromise: Promise<ArchivedUserReview | null> = Promise.resolve(null);
  act(() => {
    firstPromise = result.current.archiveUserReview(activeRun);
  });
  await expect(
    result.current.archiveUserReview(secondActiveRun),
  ).resolves.toBeNull();

  expect(archiveUserReview).toHaveBeenCalledTimes(1);
  expect(result.current.archiveState.status).toBe("saving");

  await act(async () => {
    firstArchive.resolve({ userReview: archivedRun });
    await firstPromise;
  });

  expect(result.current.archiveState).toMatchObject({
    status: "success",
    result: archivedRun,
  });
  expect(onUserReviewEvent).toHaveBeenCalledTimes(1);
  expect(onUserReviewEvent).toHaveBeenCalledWith({
    selectionId: "/workspace/spec-reviewer:file:auth:tasks",
    event: {
      type: "reviewArchived",
      review: archivedRun,
    },
  });
  result.unmount();
});
