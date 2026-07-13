import * as TestValues from "@/shared/testing/validatedValueObjects";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test } from "vitest";
import type { SpecViewResetKeys } from "@/app/App/hooks/types";
import {
  type UseUserReviewWorkspaceModeOptions,
  type UseUserReviewWorkspaceModeResult,
  useUserReviewWorkspaceMode,
} from "@/app/App/hooks/useUserReviewWorkspaceMode";

type HookHandle<Props, Result> = Readonly<{
  current: Result;
  rerender: (props: Props) => void;
  unmount: () => void;
}>;

function renderHook<Props, Result>(
  hook: (props: Props) => Result,
  initialProps: Props,
): HookHandle<Props, Result> {
  const container = document.createElement("div");
  const root = createRoot(container);
  const result = { current: undefined as Result };

  function TestComponent(props: Readonly<{ hookProps: Props }>): null {
    result.current = hook(props.hookProps);
    return null;
  }

  act(() => {
    root.render(<TestComponent hookProps={initialProps} />);
  });

  return {
    get current() {
      return result.current;
    },
    rerender: (props: Props) => {
      act(() => {
        root.render(<TestComponent hookProps={props} />);
      });
    },
    unmount: () => {
      act(() => {
        root.unmount();
      });
    },
  };
}

const baseKeys: SpecViewResetKeys = {
  workspaceRoot: "/workspace",
  specId: TestValues.specId("spec-1"),
  fileKey: "impl",
};

function render(resetKeys: SpecViewResetKeys) {
  return renderHook<
    UseUserReviewWorkspaceModeOptions,
    UseUserReviewWorkspaceModeResult
  >((props) => useUserReviewWorkspaceMode(props), { resetKeys });
}

test("初期値はcurrentWorkspace", () => {
  const hook = render(baseKeys);

  expect(hook.current.workspaceMode).toBe("currentWorkspace");
  hook.unmount();
});

test("setWorkspaceModeでモードが変更される", () => {
  const hook = render(baseKeys);

  act(() => {
    hook.current.setWorkspaceMode("worktree");
  });

  expect(hook.current.workspaceMode).toBe("worktree");
  hook.unmount();
});

test.each([
  ["fileKey", { ...baseKeys, fileKey: "tasks" as const }],
  ["specId", { ...baseKeys, specId: TestValues.specId("spec-2") }],
  ["workspaceRoot", { ...baseKeys, workspaceRoot: "/other" }],
])("%s変更でcurrentWorkspaceへリセットされる", (_label, nextKeys) => {
  const hook = render(baseKeys);

  act(() => {
    hook.current.setWorkspaceMode("worktree");
  });

  hook.rerender({ resetKeys: nextKeys });

  expect(hook.current.workspaceMode).toBe("currentWorkspace");
  hook.unmount();
});

test("同一キーのrerenderでは変更済みモードが維持される", () => {
  const hook = render(baseKeys);

  act(() => {
    hook.current.setWorkspaceMode("worktree");
  });

  hook.rerender({ resetKeys: { ...baseKeys } });

  expect(hook.current.workspaceMode).toBe("worktree");
  hook.unmount();
});
