import { act, type ReactElement } from "react";
import { createRoot } from "react-dom/client";
import { expect, test } from "vitest";

import type { WorkspaceWorktrees } from "@/features/workspace/domain/worktree";
import {
  type UseWorkspaceNavigationStateResult,
  useWorkspaceNavigationState,
} from "@/features/workspace/hooks/useWorkspaceNavigationState";
import type { WorkspaceWorktreesLoadState } from "@/features/workspace/types/workspaceWorktreesLoadState";

const workspace: WorkspaceWorktrees = {
  workspaceId: "workspace-a",
  worktrees: [
    {
      id: "one",
      name: "One",
      categoryPath: [],
      specs: [{ id: "spec-one", title: "Spec one", isArchived: false }],
      changedFiles: [{ id: "diff-one", path: "src/one.ts" }],
    },
    {
      id: "two",
      name: "Two",
      categoryPath: [],
      specs: [],
      changedFiles: [],
    },
  ],
};

test("初期 mode は Specs で先頭 worktree を選ぶ", () => {
  const result = renderHook({ status: "ready", data: workspace });

  expect(result.current.state.mode).toBe("specs");
  expect(result.current.state.activeWorktreeId).toBe("one");
  result.unmount();
});

test("mode は worktree を往復しても session-global に維持する", () => {
  const result = renderHook({ status: "ready", data: workspace });

  act(() => {
    result.current.actions.changeMode("diff");
    result.current.actions.selectWorktree("two");
    result.current.actions.selectWorktree("one");
  });

  expect(result.current.state.mode).toBe("diff");
  result.unmount();
});

test("選択履歴を workspace・worktree・mode ごとに復元する", () => {
  const result = renderHook({ status: "ready", data: workspace });

  act(() => {
    result.current.actions.selectItem("spec-one");
    result.current.actions.changeMode("diff");
    result.current.actions.selectItem("diff-one");
    result.current.actions.changeMode("specs");
  });

  expect(result.current.state.selectedItemId).toBe("spec-one");

  act(() => {
    result.current.actions.changeMode("diff");
  });

  expect(result.current.state.selectedItemId).toBe("diff-one");
  result.unmount();
});

test("sourceが未接続になっても復帰時に先頭以外の選択を復元する", () => {
  const source: WorkspaceWorktreesLoadState = {
    status: "ready",
    data: {
      workspaceId: "workspace-a",
      worktrees: [
        {
          id: "one",
          name: "One",
          categoryPath: [],
          changedFiles: [],
          specs: [
            { id: "first", title: "First", isArchived: false },
            { id: "second", title: "Second", isArchived: false },
          ],
        },
      ],
    },
  };
  const result = renderHook(source);
  act(() => result.current.actions.selectItem("second"));
  const history = result.current.state.selectedItemIdBySelectionKey;

  result.rerender({
    status: "unavailable",
    reason: "data-source-not-connected",
  });
  expect(result.current.state.workspaceId).toBeNull();
  expect(result.current.state.activeWorktreeId).toBeNull();
  expect(result.current.state.selectedItemId).toBeNull();
  expect(result.current.state.selectedItemIdBySelectionKey).toBe(history);
  expect(result.current.navigationNodes).toEqual([]);

  result.rerender(source);
  expect(result.current.state.activeWorktreeId).toBe("one");
  expect(result.current.state.selectedItemId).toBe("second");
  result.unmount();
});

type HookResult = Readonly<{
  current: UseWorkspaceNavigationStateResult;
  unmount: () => void;
  rerender: (source: WorkspaceWorktreesLoadState) => void;
}>;

/**
 * Signals that the probe component never captured a hook result.
 *
 * @throws Always throws to surface an unrendered hook as a test failure.
 * @returns Never returns; the call site treats it as a nullish fallback.
 */
function raiseHookNotRendered(): never {
  throw new Error("Hook result was not rendered");
}

/**
 * Renders the navigation hook with a mutable result holder.
 *
 * @param source - Initial worktree source.
 * @returns Latest hook value and cleanup callback.
 */
function renderHook(source: WorkspaceWorktreesLoadState): HookResult {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const holder: { current: UseWorkspaceNavigationStateResult | null } = {
    current: null,
  };

  function Probe(
    props: Readonly<{ source: WorkspaceWorktreesLoadState }>,
  ): ReactElement | null {
    holder.current = useWorkspaceNavigationState(props.source);
    return null;
  }

  act(() => {
    root.render(<Probe source={source} />);
  });

  return {
    get current() {
      return holder.current ?? raiseHookNotRendered();
    },
    /**
     * @param nextSource - Snapshot to deliver to the mounted hook.
     */
    rerender: (nextSource) => {
      act(() => {
        root.render(<Probe source={nextSource} />);
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
