import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";
import { CommentId } from "@/features/comments/types/comment";
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
import type { SpecFileKey } from "@/features/specs/types/spec";
import type { UserReviewCommands } from "@/shared/api/tauri";
import { WorkspacePath } from "@/shared/domain/workspacePath";
import { configurePerformanceLoggerForTest } from "@/shared/lib/performance";

const commentId = CommentId.fromString;

const activeRun: UserReview = {
  schemaVersion: "spec-reviewer.user-review.v1",
  id: "2026-05-06T120000Z-file-tasks-abcdef12",
  status: "active",
  target: {
    scope: "file",
    specId: "auth",
    fileKey: "tasks",
  },
  recordLocator: "2026-05-06T120000Z-file-tasks-abcdef12.json",
  commentCount: 1,
  createdAt: "2026-05-06T12:00:00Z",
  updatedAt: "2026-05-06T12:00:00Z",
  archivedAt: null,
};

const archivedRun: UserReview = {
  ...activeRun,
  status: "archived",
  updatedAt: "2026-05-06T12:30:00Z",
  archivedAt: "2026-05-06T12:30:00Z",
};

const selectionId = "/workspace/spec-reviewer:file:auth:tasks";
const billingSelectionId = "/workspace/spec-reviewer:file:billing:tasks";
const otherWorkspaceSelectionId =
  "/workspace/other-spec-reviewer:file:auth:tasks";
const idleSelectionId = "none:file:auth:tasks";

type HookProps = Readonly<{
  workspacePath: string | null;
  specId: string | null;
  fileKey: SpecFileKey | null;
  targetScope: UserReviewTargetScope;
  selectionId: string;
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
    ({ workspacePath, specId, fileKey, targetScope, selectionId, commands }) =>
      useUserReviews({
        selectionSnapshot: {
          selection: {
            workspacePath:
              workspacePath === null
                ? null
                : WorkspacePath.fromString(workspacePath),
            specId,
            fileKey,
            targetScope,
          },
          selectionId,
        },
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
    selectionId: idleSelectionId,
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
    selectionId,
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
    selectionId,
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
    selectionId,
    commands: double.commands,
  });

  await flushAsyncEffects();
  await act(async () => {
    await result.current.createUserReview({
      commentIds: [commentId("cmt_1")],
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
    },
  ]);
  result.unmount();
});

test("useUserReviewsはactive runをアーカイブして一覧を移動する", async () => {
  const double = createUserReviewCommandTestDouble({
    listUserReviews: {
      active: [activeRun],
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
    selectionId,
    commands: double.commands,
  });

  await flushAsyncEffects();
  await act(async () => {
    await result.current.archiveUserReview(activeRun);
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
      userReviewId: activeRun.id,
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
    selectionId,
    commands,
  });

  await act(async () => {
    await result.current.createUserReview({
      commentIds: [commentId("cmt_1")],
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

test("useUserReviewsはselectionId変更後に完了したcreateを現在listへ反映しない", async () => {
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
    selectionId,
    commands,
  });

  await flushAsyncEffects();
  const createPromise = result.current.createUserReview({
    commentIds: [commentId("cmt_1")],
  });
  result.rerender({
    workspacePath: "/workspace/spec-reviewer",
    specId: "auth",
    fileKey: "tasks",
    targetScope: "file",
    selectionId: "/workspace/spec-reviewer:file:auth:tasks:next",
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

test("useUserReviewsはselectionId変更後に完了したarchiveを現在listへ反映しない", async () => {
  const archiveDeferred = createDeferred<ArchiveUserReviewResponse>();
  const commands: UserReviewCommands = {
    listUserReviews: vi.fn().mockResolvedValue({
      active: [activeRun],
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
    selectionId,
    commands,
  });

  await flushAsyncEffects();
  const archivePromise = result.current.archiveUserReview(activeRun);
  result.rerender({
    workspacePath: "/workspace/spec-reviewer",
    specId: "auth",
    fileKey: "tasks",
    targetScope: "file",
    selectionId: "/workspace/spec-reviewer:file:auth:tasks:next",
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
    selectionId,
    commands,
  });

  await flushAsyncEffects();
  const createPromise = result.current.createUserReview({
    commentIds: [commentId("cmt_1")],
  });
  result.rerender({
    workspacePath: "/workspace/spec-reviewer",
    specId: "billing",
    fileKey: "tasks",
    targetScope: "file",
    selectionId: billingSelectionId,
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

test("useUserReviewsはworkspace変更後に完了したcreateを現在listへ反映しない", async () => {
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
    selectionId,
    commands,
  });

  await flushAsyncEffects();
  const createPromise = result.current.createUserReview({
    commentIds: [commentId("cmt_1")],
  });
  result.rerender({
    workspacePath: "/workspace/other-spec-reviewer",
    specId: "auth",
    fileKey: "tasks",
    targetScope: "file",
    selectionId: otherWorkspaceSelectionId,
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

test("useUserReviewsはtarget変更後に完了したarchiveを現在listへ反映しない", async () => {
  const archiveDeferred = createDeferred<ArchiveUserReviewResponse>();
  const commands: UserReviewCommands = {
    listUserReviews: vi.fn().mockResolvedValue({
      active: [activeRun],
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
    selectionId,
    commands,
  });

  await flushAsyncEffects();
  const archivePromise = result.current.archiveUserReview(activeRun);
  result.rerender({
    workspacePath: "/workspace/spec-reviewer",
    specId: "billing",
    fileKey: "tasks",
    targetScope: "file",
    selectionId: billingSelectionId,
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
