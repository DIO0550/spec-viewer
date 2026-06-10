import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";
import { CommentId } from "@/features/comments";
import {
  type UserReviewTargetScope,
  useUserReviews,
} from "@/features/review-runs/hooks/useUserReviews";
import { createUserReviewCommandTestDouble } from "@/features/review-runs/testing/review-run-command-test-double";
import type {
  ArchiveUserReviewResponse,
  CreateUserReviewResponse,
  ListUserReviewsResponse,
  UserReview,
} from "@/features/review-runs/types/userReviewIpc";
import type { UserReviewCommands } from "@/shared/api/tauri";
import { configurePerformanceLoggerForTest } from "@/shared/lib/performance";
import type { SpecFileKey } from "@/shared/types/specFileKey";

const commentId = CommentId.fromString;

const activeRun: UserReview = {
  id: "2026-05-06T120000Z-file-tasks-abcdef12",
  status: "active",
  target: {
    scope: "file",
    specId: "auth",
    fileKey: "tasks",
  },
  workspace: {
    mode: "currentWorkspace",
    workspacePath: "/workspace/spec-reviewer",
  },
  specFolderPath: "/workspace/spec-reviewer/.plugin-workspace/.specs/auth",
  folderPath:
    "/workspace/spec-reviewer/.plugin-workspace/.specs/auth/user-review/active/2026-05-06T120000Z-file-tasks-abcdef12",
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

const completedRun: UserReview = {
  ...activeRun,
  status: "completed",
  summary: "対応完了",
};

const archivedRun: UserReview = {
  ...completedRun,
  status: "archived",
  folderPath:
    "/workspace/spec-reviewer/.plugin-workspace/.specs/auth/user-review/archive/2026-05-06T120000Z-file-tasks-abcdef12",
  archivedAt: "2026-05-06T12:30:00Z",
};

const secondActiveRun: UserReview = {
  ...activeRun,
  id: "2026-05-06T120100Z-file-tasks-fedcba98",
};

type HookProps = Readonly<{
  workspacePath: string | null;
  specId: string | null;
  fileKey: SpecFileKey | null;
  targetScope: UserReviewTargetScope;
  commands: UserReviewCommands;
}>;

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

function renderUseUserReviews(props: HookProps) {
  return renderHook(
    ({ workspacePath, specId, fileKey, targetScope, commands }) =>
      useUserReviews({
        workspacePath,
        specId,
        fileKey,
        targetScope,
        commands,
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

test("useUserReviewsはscope未選択ならidleで一覧を読み込まない", async () => {
  const double = createUserReviewCommandTestDouble();
  const result = renderUseUserReviews({
    workspacePath: null,
    specId: "auth",
    fileKey: "tasks",
    targetScope: "file",
    commands: double.commands,
  });

  await flushAsyncEffects();

  expect(result.current.listState.status).toBe("idle");
  expect(result.current.activeReviews).toEqual([]);
  expect(double.calls.listUserReviews).toEqual([]);
  result.unmount();
});

test("useUserReviewsは対象が揃うとactive run一覧を読み込む", async () => {
  const double = createUserReviewCommandTestDouble({
    listUserReviews: {
      active: [activeRun],
      archived: [],
      problems: [],
    },
  });
  const result = renderUseUserReviews({
    workspacePath: "/workspace/spec-reviewer",
    specId: "auth",
    fileKey: "tasks",
    targetScope: "file",
    commands: double.commands,
  });

  await flushAsyncEffects();

  expect(result.current.listState.status).toBe("ready");
  expect(result.current.activeReviews).toEqual([activeRun]);
  expect(double.calls.listUserReviews).toEqual([
    {
      workspacePath: "/workspace/spec-reviewer",
      target: {
        scope: "file",
        specId: "auth",
        fileKey: "tasks",
      },
    },
  ]);
  result.unmount();
});

test("useUserReviewsは一覧読み込み失敗時もperformance spanを記録する", async () => {
  configurePerformanceLoggerForTest(true);
  const debugSpy = vi
    .spyOn(console, "debug")
    .mockImplementation(() => undefined);
  const double = createUserReviewCommandTestDouble();
  const commands: UserReviewCommands = {
    ...double.commands,
    listUserReviews: vi.fn().mockRejectedValue("review runs load failed"),
  };
  const result = renderUseUserReviews({
    workspacePath: "/workspace/spec-reviewer",
    specId: "auth",
    fileKey: "tasks",
    targetScope: "file",
    commands,
  });

  await flushAsyncEffects();

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

test("useUserReviewsは作成したactive runを一覧の先頭に追加する", async () => {
  const double = createUserReviewCommandTestDouble({
    listUserReviews: {
      active: [],
      archived: [],
      problems: [],
    },
    createUserReview: {
      userReview: activeRun,
    },
  });
  const result = renderUseUserReviews({
    workspacePath: "/workspace/spec-reviewer",
    specId: "auth",
    fileKey: "tasks",
    targetScope: "file",
    commands: double.commands,
  });

  await flushAsyncEffects();
  await act(async () => {
    await result.current.createUserReview({
      commentIds: [commentId("cmt_1")],
      workspaceMode: "currentWorkspace",
    });
  });

  expect(result.current.createState.status).toBe("success");
  expect(result.current.activeReviews).toEqual([activeRun]);
  expect(double.calls.createUserReview).toEqual([
    {
      workspacePath: "/workspace/spec-reviewer",
      target: {
        scope: "file",
        specId: "auth",
        fileKey: "tasks",
      },
      commentIds: ["cmt_1"],
      workspaceMode: "currentWorkspace",
    },
  ]);
  result.unmount();
});

test("useUserReviewsはcompleted runをアーカイブして一覧を移動する", async () => {
  const double = createUserReviewCommandTestDouble({
    listUserReviews: {
      active: [completedRun],
      archived: [],
      problems: [],
    },
    archiveUserReview: {
      userReview: archivedRun,
    },
  });
  const result = renderUseUserReviews({
    workspacePath: "/workspace/spec-reviewer",
    specId: "auth",
    fileKey: "tasks",
    targetScope: "file",
    commands: double.commands,
  });

  await flushAsyncEffects();
  await act(async () => {
    await result.current.archiveUserReview(completedRun.id);
  });

  expect(result.current.archiveState.status).toBe("success");
  expect(result.current.activeReviews).toEqual([]);
  expect(result.current.archivedReviews).toEqual([archivedRun]);
  expect(double.calls.archiveUserReview).toEqual([
    {
      workspacePath: "/workspace/spec-reviewer",
      target: {
        scope: "file",
        specId: "auth",
        fileKey: "tasks",
      },
      userReviewId: completedRun.id,
    },
  ]);
  result.unmount();
});

test("useUserReviewsはloading中のcreate成功を古いlist responseで上書きしない", async () => {
  const listDeferred = createDeferred<ListUserReviewsResponse>();
  const commands: UserReviewCommands = {
    listUserReviews: vi.fn().mockReturnValue(listDeferred.promise),
    createUserReview: vi.fn().mockResolvedValue({ userReview: activeRun }),
    archiveUserReview: vi.fn().mockResolvedValue({ userReview: archivedRun }),
  };
  const result = renderUseUserReviews({
    workspacePath: "/workspace/spec-reviewer",
    specId: "auth",
    fileKey: "tasks",
    targetScope: "file",
    commands,
  });

  await act(async () => {
    await result.current.createUserReview({
      commentIds: [commentId("cmt_1")],
      workspaceMode: "currentWorkspace",
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

  expect(result.current.activeReviews).toEqual([activeRun]);
  result.unmount();
});

test("useUserReviewsはtarget変更後に完了したcreateを現在listへ反映しない", async () => {
  const createRunDeferred = createDeferred<CreateUserReviewResponse>();
  const commands: UserReviewCommands = {
    listUserReviews: vi.fn().mockResolvedValue({
      active: [],
      archived: [],
      problems: [],
    }),
    createUserReview: vi.fn().mockReturnValue(createRunDeferred.promise),
    archiveUserReview: vi.fn().mockResolvedValue({ userReview: archivedRun }),
  };
  const result = renderUseUserReviews({
    workspacePath: "/workspace/spec-reviewer",
    specId: "auth",
    fileKey: "tasks",
    targetScope: "file",
    commands,
  });

  await flushAsyncEffects();
  const createPromise = result.current.createUserReview({
    commentIds: [commentId("cmt_1")],
    workspaceMode: "currentWorkspace",
  });
  result.rerender({
    workspacePath: "/workspace/spec-reviewer",
    specId: "billing",
    fileKey: "tasks",
    targetScope: "file",
    commands,
  });
  await flushAsyncEffects();

  await act(async () => {
    createRunDeferred.resolve({ userReview: activeRun });
    await createPromise;
  });

  expect(result.current.createState.status).toBe("idle");
  expect(result.current.activeReviews).toEqual([]);
  result.unmount();
});

test("useUserReviewsは同一targetの古いcreate完了を現在stateとlistへ反映しない", async () => {
  const firstCreateDeferred = createDeferred<CreateUserReviewResponse>();
  const commands: UserReviewCommands = {
    listUserReviews: vi.fn().mockResolvedValue({
      active: [],
      archived: [],
      problems: [],
    }),
    createUserReview: vi
      .fn()
      .mockReturnValueOnce(firstCreateDeferred.promise)
      .mockResolvedValueOnce({ userReview: secondActiveRun }),
    archiveUserReview: vi.fn().mockResolvedValue({ userReview: archivedRun }),
  };
  const result = renderUseUserReviews({
    workspacePath: "/workspace/spec-reviewer",
    specId: "auth",
    fileKey: "tasks",
    targetScope: "file",
    commands,
  });

  await flushAsyncEffects();
  const firstCreatePromise = result.current.createUserReview({
    commentIds: [commentId("cmt_1")],
    workspaceMode: "currentWorkspace",
  });
  await act(async () => {
    await result.current.createUserReview({
      commentIds: [commentId("cmt_2")],
      workspaceMode: "currentWorkspace",
    });
  });
  await act(async () => {
    firstCreateDeferred.resolve({ userReview: activeRun });
    await firstCreatePromise;
  });

  expect(result.current.createState.userReview).toEqual(secondActiveRun);
  expect(result.current.activeReviews).toEqual([secondActiveRun]);
  result.unmount();
});

test("useUserReviewsはtarget変更後に完了したarchiveを現在listへ反映しない", async () => {
  const archiveDeferred = createDeferred<ArchiveUserReviewResponse>();
  const commands: UserReviewCommands = {
    listUserReviews: vi.fn().mockResolvedValue({
      active: [completedRun],
      archived: [],
      problems: [],
    }),
    createUserReview: vi.fn().mockResolvedValue({ userReview: activeRun }),
    archiveUserReview: vi.fn().mockReturnValue(archiveDeferred.promise),
  };
  const result = renderUseUserReviews({
    workspacePath: "/workspace/spec-reviewer",
    specId: "auth",
    fileKey: "tasks",
    targetScope: "file",
    commands,
  });

  await flushAsyncEffects();
  const archivePromise = result.current.archiveUserReview(completedRun.id);
  result.rerender({
    workspacePath: "/workspace/spec-reviewer",
    specId: "billing",
    fileKey: "tasks",
    targetScope: "file",
    commands,
  });
  await flushAsyncEffects();

  await act(async () => {
    archiveDeferred.resolve({ userReview: archivedRun });
    await archivePromise;
  });

  expect(result.current.archiveState.status).toBe("idle");
  expect(result.current.archivedReviews).toEqual([]);
  result.unmount();
});
