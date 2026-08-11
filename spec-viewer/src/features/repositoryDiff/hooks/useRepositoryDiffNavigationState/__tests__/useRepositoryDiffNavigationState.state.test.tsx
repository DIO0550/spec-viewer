import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test } from "vitest";

import {
  type UseRepositoryDiffNavigationStateOptions,
  useRepositoryDiffNavigationState,
} from "@/features/repositoryDiff/hooks/useRepositoryDiffNavigationState";

function renderNavigationHook(
  options: UseRepositoryDiffNavigationStateOptions,
): Readonly<{
  current: () => ReturnType<typeof useRepositoryDiffNavigationState>;
  rerender: (next: UseRepositoryDiffNavigationStateOptions) => void;
  unmount: () => void;
}> {
  const root = createRoot(document.createElement("div"));
  const result = {
    current: undefined as unknown as ReturnType<
      typeof useRepositoryDiffNavigationState
    >,
  };

  function TestComponent(
    props: Readonly<{ options: UseRepositoryDiffNavigationStateOptions }>,
  ): null {
    result.current = useRepositoryDiffNavigationState(props.options);
    return null;
  }

  act(() => root.render(<TestComponent options={options} />));
  return {
    current: () => result.current,
    rerender: (next) => {
      act(() => root.render(<TestComponent options={next} />));
    },
    unmount: () => {
      act(() => root.unmount());
    },
  };
}

function repository(
  worktreeId: string,
): UseRepositoryDiffNavigationStateOptions {
  return { workspaceId: "/workspace", worktreeId };
}

test("未訪問repositoryはtabなし・Unifiedで始まる", () => {
  const hook = renderNavigationHook(repository("worktree-a"));

  expect(hook.current().entry).toEqual({
    filter: "changed",
    openPaths: [],
    activePath: null,
    expandedPaths: [],
    viewerMode: "unified",
    jumpTargetsByPath: {},
  });
  hook.unmount();
});

test("公開actionはopen・activate・close・mode・jump・reconcileを接続する", () => {
  const hook = renderNavigationHook(repository("worktree-a"));
  act(() => {
    hook.current().actions.openPath("a.ts");
    hook.current().actions.openPath("b.ts");
    hook.current().actions.activateTab("a.ts");
    hook.current().actions.changeViewerMode("split");
    hook.current().actions.changeJumpTarget("a.ts", "hunk-1");
    hook.current().actions.toggleDirectory("src");
  });
  act(() => {
    hook.current().actions.closeTab("b.ts");
    hook.current().actions.reconcile(["a.ts"], ["src"]);
  });

  expect(hook.current().entry).toEqual({
    filter: "changed",
    openPaths: ["a.ts"],
    activePath: "a.ts",
    expandedPaths: ["src"],
    viewerMode: "split",
    jumpTargetsByPath: { "a.ts": "hunk-1" },
  });
  hook.unmount();
});

test("worktree A/Bを往復するとrepository固有entryを復元する", () => {
  const hook = renderNavigationHook(repository("worktree-a"));
  act(() => {
    hook.current().actions.changeFilter("all");
    hook.current().actions.openPath("src/a.ts");
    hook.current().actions.changeViewerMode("editor");
  });

  hook.rerender(repository("worktree-b"));
  act(() => {
    hook.current().actions.openPath("src/b.ts");
  });

  hook.rerender(repository("worktree-a"));
  expect(hook.current().entry.activePath).toBe("src/a.ts");
  expect(hook.current().entry.viewerMode).toBe("editor");
  hook.rerender(repository("worktree-b"));
  expect(hook.current().entry.activePath).toBe("src/b.ts");
  expect(hook.current().entry.viewerMode).toBe("unified");
  hook.unmount();
});

test("null keyのactionはstateを変更しない", () => {
  const hook = renderNavigationHook({
    workspaceId: null,
    worktreeId: null,
  });
  const initial = hook.current().state;
  act(() => {
    hook.current().actions.openPath("a.ts");
    hook.current().actions.activateTab("a.ts");
    hook.current().actions.closeTab("a.ts");
    hook.current().actions.changeViewerMode("editor");
    hook.current().actions.changeJumpTarget("a.ts", "hunk-1");
    hook.current().actions.reconcile(["a.ts"], []);
  });

  expect(hook.current().key).toBeNull();
  expect(hook.current().state).toBe(initial);
  hook.unmount();
});

test("key不変のrerenderではaction objectの参照を維持する", () => {
  const options = repository("worktree-a");
  const hook = renderNavigationHook(options);
  const actions = hook.current().actions;

  hook.rerender({ ...options });

  expect(hook.current().actions).toBe(actions);
  hook.unmount();
});

test("unmount後に保持したactionを呼んでも例外にならない", () => {
  const hook = renderNavigationHook(repository("worktree-a"));
  const actions = hook.current().actions;
  hook.unmount();

  expect(() => {
    actions.changeFilter("all");
    actions.openPath("a.ts");
    actions.activateTab("a.ts");
    actions.closeTab("a.ts");
    actions.changeViewerMode("editor");
    actions.changeJumpTarget("a.ts", null);
    actions.toggleDirectory("src");
    actions.reconcile([], []);
  }).not.toThrow();
});
