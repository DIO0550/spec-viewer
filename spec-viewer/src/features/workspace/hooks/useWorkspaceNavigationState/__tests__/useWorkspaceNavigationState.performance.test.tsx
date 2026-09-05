import { act, type ReactElement } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";

import type { WorkspaceWorktrees } from "@/features/workspace/domain/worktree";
import {
  type UseWorkspaceNavigationStateResult,
  useWorkspaceNavigationState,
} from "@/features/workspace/hooks/useWorkspaceNavigationState";

const projectionCalls = vi.hoisted(() => vi.fn());

vi.mock(
  "@/features/workspace/lib/projectWorktreeTree",
  async (importOriginal) => {
    const actual =
      await importOriginal<
        typeof import("@/features/workspace/lib/projectWorktreeTree")
      >();

    return {
      ...actual,
      projectWorktreeTree: (
        ...args: Parameters<typeof actual.projectWorktreeTree>
      ) => {
        projectionCalls();
        return actual.projectWorktreeTree(...args);
      },
    };
  },
);

test("1000 worktree projectionは初回とmode変更時だけ再計算する", () => {
  const source: WorkspaceWorktrees = {
    workspaceId: "large",
    worktrees: Array.from({ length: 1000 }, (_, index) => ({
      id: `worktree-${index}`,
      name: `Worktree ${index}`,
      categoryPath: [],
      specs: [
        {
          id: `spec-${index}`,
          title: `Spec ${index}`,
          isArchived: false,
        },
      ],
      changedFiles: [{ id: `file-${index}`, path: `src/${index}.ts` }],
    })),
  };
  const loadState = { status: "ready", data: source } as const;
  const container = document.createElement("div");
  const root = createRoot(container);
  const holder: { current: UseWorkspaceNavigationStateResult | null } = {
    current: null,
  };

  function Probe(): ReactElement | null {
    holder.current = useWorkspaceNavigationState(loadState);
    return null;
  }

  act(() => {
    root.render(<Probe />);
  });
  expect(projectionCalls).toHaveBeenCalledTimes(1);

  act(() => {
    holder.current?.actions.selectItem("spec-0");
  });
  expect(projectionCalls).toHaveBeenCalledTimes(1);

  act(() => {
    holder.current?.actions.changeMode("diff");
  });
  expect(projectionCalls).toHaveBeenCalledTimes(2);

  act(() => {
    root.unmount();
  });
});
