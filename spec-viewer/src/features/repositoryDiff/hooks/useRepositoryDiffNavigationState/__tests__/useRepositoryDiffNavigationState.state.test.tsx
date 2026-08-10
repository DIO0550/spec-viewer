import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test } from "vitest";

import {
  type UseRepositoryDiffNavigationStateOptions,
  useRepositoryDiffNavigationState,
} from "@/features/repositoryDiff/hooks/useRepositoryDiffNavigationState";

function renderHook(
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

const repository = (
  worktreeId: string,
): UseRepositoryDiffNavigationStateOptions => ({
  workspaceId: "/workspace",
  worktreeId,
});

test("未訪問repositoryはChanged・未選択・未展開で始まる", () => {
  const hook = renderHook(repository("worktree-a"));

  expect(hook.current().entry).toEqual({
    filter: "changed",
    selectedPath: null,
    expandedPaths: [],
  });
  hook.unmount();
});

test("worktree A/Bを往復するとrepository-specific entryを復元する", () => {
  const hook = renderHook(repository("worktree-a"));
  act(() => {
    hook.current().actions.changeFilter("all");
    hook.current().actions.selectPath("src/a.ts");
    hook.current().actions.toggleDirectory("src");
  });

  hook.rerender(repository("worktree-b"));
  expect(hook.current().entry.filter).toBe("changed");
  act(() => {
    hook.current().actions.selectPath("src/b.ts");
  });

  hook.rerender(repository("worktree-a"));
  expect(hook.current().entry).toEqual({
    filter: "all",
    selectedPath: "src/a.ts",
    expandedPaths: ["src"],
  });
  hook.rerender(repository("worktree-b"));
  expect(hook.current().entry.selectedPath).toBe("src/b.ts");
  hook.unmount();
});

test("filter toggleはstateだけを更新し、reconcileは無効pathをpruneする", () => {
  const hook = renderHook(repository("worktree-a"));
  act(() => {
    hook.current().actions.changeFilter("all");
    hook.current().actions.selectPath("src/old.ts");
    hook.current().actions.toggleDirectory("src");
  });
  act(() => {
    hook.current().actions.reconcile(["src/new.ts"], []);
  });

  expect(hook.current().entry).toEqual({
    filter: "all",
    selectedPath: null,
    expandedPaths: [],
  });
  hook.unmount();
});

test("unmounted hookのactionは外部stateを更新しない", () => {
  const hook = renderHook(repository("worktree-a"));
  const actions = hook.current().actions;
  hook.unmount();

  expect(() => {
    actions.changeFilter("all");
    actions.selectPath("src/a.ts");
    actions.toggleDirectory("src");
  }).not.toThrow();
});
