import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";

import { configurePerformanceLoggerForTest } from "@/shared/lib/performance";
import { createReviewRunCommandTestDouble } from "@/features/review-runs/testing/review-run-command-test-double";
import { CommentId } from "@/features/comments/types/comment";
import type { ReviewRunCommands } from "@/shared/api/tauri";
import type {
  ArchiveReviewRunResponse,
  CreateReviewRunResponse,
  ListReviewRunsResponse,
  ReviewRun,
} from "@/features/review-runs/types/reviewRun";
import type { SpecFileKey } from "@/features/specs/types/spec";
import {
  useReviewRuns,
  type ReviewRunTargetScope,
} from "@/features/review-runs/hooks/useReviewRuns";

const commentId = CommentId.fromString;

const activeRun: ReviewRun = {
  id: "2026-05-06T120000Z-file-tasks-abcdef12",
  status: "active",
  target: {
    scope: "file",
    specId: "auth",
    fileKey: "tasks",
  },
  executionTarget: {
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

const completedRun: ReviewRun = {
  ...activeRun,
  status: "completed",
  summary: "対応完了",
};

const archivedRun: ReviewRun = {
  ...completedRun,
  status: "archived",
  folderPath:
    "/workspace/spec-reviewer/.plugin-workspace/.specs/auth/user-review/archive/2026-05-06T120000Z-file-tasks-abcdef12",
  archivedAt: "2026-05-06T12:30:00Z",
};

const secondActiveRun: ReviewRun = {
  ...activeRun,
  id: "2026-05-06T120100Z-file-tasks-fedcba98",
};

type HookProps = Readonly<{
  workspacePath: string | null;
  specId: string | null;
  fileKey: SpecFileKey | null;
  targetScope: ReviewRunTargetScope;
  commands: ReviewRunCommands;
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

function renderUseReviewRuns(props: HookProps) {
  return renderHook(
    ({ workspacePath, specId, fileKey, targetScope, commands }) =>
      useReviewRuns({
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

test("useReviewRunsはscope未選択ならidleで一覧を読み込まない", async () => {
  const double = createReviewRunCommandTestDouble();
  const result = renderUseReviewRuns({
    workspacePath: null,
    specId: "auth",
    fileKey: "tasks",
    targetScope: "file",
    commands: double.commands,
  });

  await flushAsyncEffects();

  expect(result.current.listState.status).toBe("idle");
  expect(result.current.activeRuns).toEqual([]);
  expect(double.calls.listReviewRuns).toEqual([]);
  result.unmount();
});

test("useReviewRunsは対象が揃うとactive run一覧を読み込む", async () => {
  const double = createReviewRunCommandTestDouble({
    listReviewRuns: {
      active: [activeRun],
      archived: [],
      problems: [],
    },
  });
  const result = renderUseReviewRuns({
    workspacePath: "/workspace/spec-reviewer",
    specId: "auth",
    fileKey: "tasks",
    targetScope: "file",
    commands: double.commands,
  });

  await flushAsyncEffects();

  expect(result.current.listState.status).toBe("ready");
  expect(result.current.activeRuns).toEqual([activeRun]);
  expect(double.calls.listReviewRuns).toEqual([
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

test("useReviewRunsは一覧読み込み失敗時もperformance spanを記録する", async () => {
  configurePerformanceLoggerForTest(true);
  const debugSpy = vi
    .spyOn(console, "debug")
    .mockImplementation(() => undefined);
  const double = createReviewRunCommandTestDouble();
  const commands: ReviewRunCommands = {
    ...double.commands,
    listReviewRuns: vi.fn().mockRejectedValue("review runs load failed"),
  };
  const result = renderUseReviewRuns({
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
      phase: "reviewRuns.list",
      metadata: expect.objectContaining({
        error: true,
      }),
    }),
  );
  result.unmount();
  debugSpy.mockRestore();
  configurePerformanceLoggerForTest(null);
});

test("useReviewRunsは作成したactive runを一覧の先頭に追加する", async () => {
  const double = createReviewRunCommandTestDouble({
    listReviewRuns: {
      active: [],
      archived: [],
      problems: [],
    },
    createReviewRun: {
      reviewRun: activeRun,
    },
  });
  const result = renderUseReviewRuns({
    workspacePath: "/workspace/spec-reviewer",
    specId: "auth",
    fileKey: "tasks",
    targetScope: "file",
    commands: double.commands,
  });

  await flushAsyncEffects();
  await act(async () => {
    await result.current.createReviewRun({
      commentIds: [commentId("cmt_1")],
      executionMode: "currentWorkspace",
    });
  });

  expect(result.current.createState.status).toBe("success");
  expect(result.current.activeRuns).toEqual([activeRun]);
  expect(double.calls.createReviewRun).toEqual([
    {
      workspacePath: "/workspace/spec-reviewer",
      target: {
        scope: "file",
        specId: "auth",
        fileKey: "tasks",
      },
      commentIds: ["cmt_1"],
      executionMode: "currentWorkspace",
    },
  ]);
  result.unmount();
});

test("useReviewRunsはcompleted runをアーカイブして一覧を移動する", async () => {
  const double = createReviewRunCommandTestDouble({
    listReviewRuns: {
      active: [completedRun],
      archived: [],
      problems: [],
    },
    archiveReviewRun: {
      reviewRun: archivedRun,
    },
  });
  const result = renderUseReviewRuns({
    workspacePath: "/workspace/spec-reviewer",
    specId: "auth",
    fileKey: "tasks",
    targetScope: "file",
    commands: double.commands,
  });

  await flushAsyncEffects();
  await act(async () => {
    await result.current.archiveReviewRun(completedRun.id);
  });

  expect(result.current.archiveState.status).toBe("success");
  expect(result.current.activeRuns).toEqual([]);
  expect(result.current.archivedRuns).toEqual([archivedRun]);
  expect(double.calls.archiveReviewRun).toEqual([
    {
      workspacePath: "/workspace/spec-reviewer",
      target: {
        scope: "file",
        specId: "auth",
        fileKey: "tasks",
      },
      reviewRunId: completedRun.id,
    },
  ]);
  result.unmount();
});

test("useReviewRunsはloading中のcreate成功を古いlist responseで上書きしない", async () => {
  const listDeferred = createDeferred<ListReviewRunsResponse>();
  const commands: ReviewRunCommands = {
    listReviewRuns: vi.fn().mockReturnValue(listDeferred.promise),
    createReviewRun: vi.fn().mockResolvedValue({ reviewRun: activeRun }),
    archiveReviewRun: vi.fn().mockResolvedValue({ reviewRun: archivedRun }),
  };
  const result = renderUseReviewRuns({
    workspacePath: "/workspace/spec-reviewer",
    specId: "auth",
    fileKey: "tasks",
    targetScope: "file",
    commands,
  });

  await act(async () => {
    await result.current.createReviewRun({
      commentIds: [commentId("cmt_1")],
      executionMode: "currentWorkspace",
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

  expect(result.current.activeRuns).toEqual([activeRun]);
  result.unmount();
});

test("useReviewRunsはtarget変更後に完了したcreateを現在listへ反映しない", async () => {
  const createRunDeferred = createDeferred<CreateReviewRunResponse>();
  const commands: ReviewRunCommands = {
    listReviewRuns: vi.fn().mockResolvedValue({
      active: [],
      archived: [],
      problems: [],
    }),
    createReviewRun: vi.fn().mockReturnValue(createRunDeferred.promise),
    archiveReviewRun: vi.fn().mockResolvedValue({ reviewRun: archivedRun }),
  };
  const result = renderUseReviewRuns({
    workspacePath: "/workspace/spec-reviewer",
    specId: "auth",
    fileKey: "tasks",
    targetScope: "file",
    commands,
  });

  await flushAsyncEffects();
  const createPromise = result.current.createReviewRun({
    commentIds: [commentId("cmt_1")],
    executionMode: "currentWorkspace",
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
    createRunDeferred.resolve({ reviewRun: activeRun });
    await createPromise;
  });

  expect(result.current.createState.status).toBe("idle");
  expect(result.current.activeRuns).toEqual([]);
  result.unmount();
});

test("useReviewRunsは同一targetの古いcreate完了を現在stateとlistへ反映しない", async () => {
  const firstCreateDeferred = createDeferred<CreateReviewRunResponse>();
  const commands: ReviewRunCommands = {
    listReviewRuns: vi.fn().mockResolvedValue({
      active: [],
      archived: [],
      problems: [],
    }),
    createReviewRun: vi
      .fn()
      .mockReturnValueOnce(firstCreateDeferred.promise)
      .mockResolvedValueOnce({ reviewRun: secondActiveRun }),
    archiveReviewRun: vi.fn().mockResolvedValue({ reviewRun: archivedRun }),
  };
  const result = renderUseReviewRuns({
    workspacePath: "/workspace/spec-reviewer",
    specId: "auth",
    fileKey: "tasks",
    targetScope: "file",
    commands,
  });

  await flushAsyncEffects();
  const firstCreatePromise = result.current.createReviewRun({
    commentIds: [commentId("cmt_1")],
    executionMode: "currentWorkspace",
  });
  await act(async () => {
    await result.current.createReviewRun({
      commentIds: [commentId("cmt_2")],
      executionMode: "currentWorkspace",
    });
  });
  await act(async () => {
    firstCreateDeferred.resolve({ reviewRun: activeRun });
    await firstCreatePromise;
  });

  expect(result.current.createState.reviewRun).toEqual(secondActiveRun);
  expect(result.current.activeRuns).toEqual([secondActiveRun]);
  result.unmount();
});

test("useReviewRunsはtarget変更後に完了したarchiveを現在listへ反映しない", async () => {
  const archiveDeferred = createDeferred<ArchiveReviewRunResponse>();
  const commands: ReviewRunCommands = {
    listReviewRuns: vi.fn().mockResolvedValue({
      active: [completedRun],
      archived: [],
      problems: [],
    }),
    createReviewRun: vi.fn().mockResolvedValue({ reviewRun: activeRun }),
    archiveReviewRun: vi.fn().mockReturnValue(archiveDeferred.promise),
  };
  const result = renderUseReviewRuns({
    workspacePath: "/workspace/spec-reviewer",
    specId: "auth",
    fileKey: "tasks",
    targetScope: "file",
    commands,
  });

  await flushAsyncEffects();
  const archivePromise = result.current.archiveReviewRun(completedRun.id);
  result.rerender({
    workspacePath: "/workspace/spec-reviewer",
    specId: "billing",
    fileKey: "tasks",
    targetScope: "file",
    commands,
  });
  await flushAsyncEffects();

  await act(async () => {
    archiveDeferred.resolve({ reviewRun: archivedRun });
    await archivePromise;
  });

  expect(result.current.archiveState.status).toBe("idle");
  expect(result.current.archivedRuns).toEqual([]);
  result.unmount();
});
