import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";

import type { UserReviewTarget } from "@/features/review-runs/domain/userReviewTarget";
import { useUserReviewList } from "@/features/review-runs/hooks/useUserReviewList";
import type {
  ListUserReviewsResponse,
  UserReview,
} from "@/features/review-runs/types/userReviewIpc";
import type { UserReviewCommands } from "@/shared/api/tauri";
import { WorkspacePath } from "@/shared/domain/workspacePath";
import { configurePerformanceLoggerForTest } from "@/shared/lib/performance";

type HookProps = Readonly<{
  workspacePath: string | null;
  target: UserReviewTarget | null;
  commands: UserReviewCommands;
  selectionKey: string;
}>;

const target = {
  scope: "file",
  specId: "auth",
  fileKey: "tasks",
} as const;

const selectionKey = "/workspace/spec-reviewer:file:auth:tasks";

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

function renderUseUserReviewList(props: HookProps) {
  return renderHook(
    ({ workspacePath, target, commands, selectionKey }) =>
      useUserReviewList({
        commands,
        target,
        selectionKey,
        workspacePath:
          workspacePath === null
            ? null
            : WorkspacePath.fromString(workspacePath),
      }),
    props,
  );
}

async function flushAsyncEffects(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
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

function createCommands(
  response: ListUserReviewsResponse = {
    active: [],
    archived: [],
    problems: [],
  },
): UserReviewCommands {
  return {
    listUserReviews: vi.fn().mockResolvedValue(response),
    createUserReview: vi.fn(),
    archiveUserReview: vi.fn(),
  };
}

test("useUserReviewListはtargetまたはworkspace不足時にcommandを呼ばずidleを返す", async () => {
  const commands = createCommands();
  const result = renderUseUserReviewList({
    workspacePath: null,
    target,
    commands,
    selectionKey: "none:file:auth:tasks",
  });

  await act(async () => {
    await result.current.reloadUserReviews();
  });

  expect(result.current.listState.status).toBe("idle");
  expect(commands.listUserReviews).not.toHaveBeenCalled();
  result.unmount();
});

test("useUserReviewListはlist成功時にactive reviewsをreadyへ反映する", async () => {
  const commands = createCommands({
    active: [activeRun],
    archived: [],
    problems: [],
  });
  const result = renderUseUserReviewList({
    workspacePath: "/workspace/spec-reviewer",
    target,
    commands,
    selectionKey,
  });

  await flushAsyncEffects();

  expect(result.current.listState.status).toBe("ready");
  expect(result.current.listState.active).toEqual([activeRun]);
  expect(commands.listUserReviews).toHaveBeenCalledWith({
    workspacePath: "/workspace/spec-reviewer",
    target,
  });
  result.unmount();
});

test("useUserReviewListはlist成功時にrunがなければemptyを返す", async () => {
  const commands = createCommands();
  const result = renderUseUserReviewList({
    workspacePath: "/workspace/spec-reviewer",
    target,
    commands,
    selectionKey,
  });

  await flushAsyncEffects();

  expect(result.current.listState.status).toBe("empty");
  expect(result.current.listState.active).toEqual([]);
  result.unmount();
});

test("useUserReviewListはlist失敗時もfrontend performance spanにerrorを記録する", async () => {
  configurePerformanceLoggerForTest(true);
  const debugSpy = vi
    .spyOn(console, "debug")
    .mockImplementation(() => undefined);
  const commands: UserReviewCommands = {
    ...createCommands(),
    listUserReviews: vi.fn().mockRejectedValue("review runs load failed"),
  };
  const result = renderUseUserReviewList({
    workspacePath: "/workspace/spec-reviewer",
    target,
    commands,
    selectionKey,
  });

  await flushAsyncEffects();

  expect(result.current.listState.status).toBe("error");
  expect(debugSpy).toHaveBeenCalledWith(
    "[spec-viewer:perf]",
    expect.objectContaining({
      type: "span",
      phase: "userReviews.list",
      metadata: expect.objectContaining({
        error: true,
      }),
    }),
  );
  result.unmount();
  debugSpy.mockRestore();
  configurePerformanceLoggerForTest(null);
});

test("useUserReviewListはidentity不一致のlist eventを反映しない", async () => {
  const commands = createCommands();
  const result = renderUseUserReviewList({
    workspacePath: "/workspace/spec-reviewer",
    target,
    commands,
    selectionKey,
  });

  await flushAsyncEffects();
  act(() => {
    result.current.applyUserReviewEvent({
      selectionKey: "/workspace/other:file:auth:tasks",
      event: {
        type: "reviewCreated",
        review: activeRun,
      },
    });
  });

  expect(result.current.listState.active).toEqual([]);
  result.unmount();
});

test("useUserReviewListはloading中のeventを古いlist responseで上書きしない", async () => {
  const listDeferred = createDeferred<ListUserReviewsResponse>();
  const commands: UserReviewCommands = {
    listUserReviews: vi.fn().mockReturnValue(listDeferred.promise),
    createUserReview: vi.fn(),
    archiveUserReview: vi.fn(),
  };
  const result = renderUseUserReviewList({
    workspacePath: "/workspace/spec-reviewer",
    target,
    selectionKey,
    commands,
  });

  act(() => {
    result.current.applyUserReviewEvent({
      selectionKey: selectionKey,
      event: {
        type: "reviewCreated",
        review: activeRun,
      },
    });
  });
  await act(async () => {
    listDeferred.resolve({
      active: [],
      archived: [],
      problems: [],
    });
    await listDeferred.promise;
  });

  expect(result.current.listState.active).toEqual([activeRun]);
  result.unmount();
});
