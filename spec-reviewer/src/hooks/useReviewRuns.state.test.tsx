import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test } from "vitest";

import { createReviewRunCommandTestDouble } from "../lib/review-run-command-test-double";
import type { ReviewRunCommands } from "../lib/tauri";
import type { ReviewRun } from "../types/reviewRun";
import type { SpecFileKey } from "../types/spec";
import { useReviewRuns, type ReviewRunTargetScope } from "./useReviewRuns";

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

test("useReviewRunsは作成したactive runを一覧の先頭に追加する", async () => {
  const double = createReviewRunCommandTestDouble({
    listReviewRuns: {
      active: [],
      archived: [],
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
      commentIds: ["cmt_1"],
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
