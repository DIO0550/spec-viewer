import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";

import type { WorkspaceWorktrees } from "@/features/workspace/domain/worktree";
import { useWorkspaceWorktrees } from "@/features/workspace/hooks/useWorkspaceWorktrees";
import { listWorktrees } from "@/lib/api/tauri";

vi.mock("@/lib/api/tauri", () => ({
  listWorktrees: vi.fn(),
}));

const listWorktreesMock = vi.mocked(listWorktrees);

const loadedWorktrees: WorkspaceWorktrees = {
  workspaceId: "/workspace/spec-reviewer",
  worktrees: [
    {
      id: "/workspace/spec-reviewer",
      name: "feature/review",
      categoryPath: [],
      specs: [],
      changedFiles: [],
    },
  ],
};

function renderHook(workspacePath: string | null): Readonly<{
  current: () => ReturnType<typeof useWorkspaceWorktrees>;
  rerender: (nextWorkspacePath: string | null) => void;
  unmount: () => void;
}> {
  const root = createRoot(document.createElement("div"));
  const result = {
    current: undefined as unknown as ReturnType<typeof useWorkspaceWorktrees>,
  };

  function TestComponent(
    props: Readonly<{ workspacePath: string | null }>,
  ): null {
    result.current = useWorkspaceWorktrees(props.workspacePath);
    return null;
  }

  act(() => {
    root.render(<TestComponent workspacePath={workspacePath} />);
  });

  return {
    current: () => result.current,
    rerender: (nextWorkspacePath) => {
      act(() => {
        root.render(<TestComponent workspacePath={nextWorkspacePath} />);
      });
    },
    unmount: () => {
      act(() => {
        root.unmount();
      });
    },
  };
}

test("useWorkspaceWorktreesはworkspace未選択時にデータソース未接続を返す", () => {
  listWorktreesMock.mockReset();

  const result = renderHook(null);

  expect(result.current()).toEqual({
    status: "unavailable",
    reason: "data-source-not-connected",
  });
  expect(listWorktreesMock).not.toHaveBeenCalled();
  result.unmount();
});

test("useWorkspaceWorktreesは取得成功後にreadyを返す", async () => {
  listWorktreesMock.mockReset();
  listWorktreesMock.mockResolvedValue(loadedWorktrees);

  const result = renderHook("/workspace/spec-reviewer");

  await act(async () => {
    await Promise.resolve();
  });

  expect(result.current()).toEqual({ status: "ready", data: loadedWorktrees });
  expect(listWorktreesMock).toHaveBeenCalledWith("/workspace/spec-reviewer");
  result.unmount();
});

test("useWorkspaceWorktreesは取得失敗後にデータソース未接続を返す", async () => {
  listWorktreesMock.mockReset();
  listWorktreesMock.mockRejectedValue(new Error("not a repository"));

  const result = renderHook("/workspace/spec-reviewer");

  await act(async () => {
    await Promise.resolve();
  });

  expect(result.current()).toEqual({
    status: "unavailable",
    reason: "data-source-not-connected",
  });
  result.unmount();
});
