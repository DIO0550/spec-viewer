import * as TestValues from "@/shared/testing/validatedValueObjects";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";

import {
  type UseGuardedSpecActionsResult,
  useGuardedSpecActions,
} from "@/app/App/hooks/useGuardedSpecActions";

type HookResult<Result> = Readonly<{
  current: Result;
  unmount: () => void;
}>;

function renderHook<Result>(hook: () => Result): HookResult<Result> {
  const container = document.createElement("div");
  const root = createRoot(container);
  const result = { current: undefined as Result };

  function TestComponent(): null {
    result.current = hook();
    return null;
  }

  act(() => {
    root.render(<TestComponent />);
  });

  return {
    get current() {
      return result.current;
    },
    unmount: () => {
      act(() => {
        root.unmount();
      });
    },
  };
}

function createActions() {
  return {
    selectSpec: vi.fn(async () => {}),
    archiveSpec: vi.fn(async () => {}),
    reloadSpecs: vi.fn(async () => {}),
    selectFileKey: vi.fn(async () => {}),
    reloadDocument: vi.fn(async () => {}),
  };
}

const cases = [
  {
    label: "selectSpecFromTree",
    actionKey: "selectSpec",
    invoke: (result: UseGuardedSpecActionsResult) =>
      result.selectSpecFromTree(TestValues.specId("spec-1")),
    expectedArgs: ["spec-1"] as const,
  },
  {
    label: "archiveSpecFromTree",
    actionKey: "archiveSpec",
    invoke: (result: UseGuardedSpecActionsResult) =>
      result.archiveSpecFromTree(TestValues.specId("spec-1")),
    expectedArgs: ["spec-1"] as const,
  },
  {
    label: "reloadSpecsFromTree",
    actionKey: "reloadSpecs",
    invoke: (result: UseGuardedSpecActionsResult) =>
      result.reloadSpecsFromTree(),
    expectedArgs: [] as const,
  },
  {
    label: "selectFileFromTabs",
    actionKey: "selectFileKey",
    invoke: (result: UseGuardedSpecActionsResult) =>
      result.selectFileFromTabs("impl"),
    expectedArgs: ["impl"] as const,
  },
  {
    label: "reloadDocumentFromViewer",
    actionKey: "reloadDocument",
    invoke: (result: UseGuardedSpecActionsResult) =>
      result.reloadDocumentFromViewer(),
    expectedArgs: [] as const,
  },
] as const;

test.each(cases)("非loading時に$labelが対応アクションを引数どおり1回呼ぶ", ({
  actionKey,
  invoke,
  expectedArgs,
}) => {
  const actions = createActions();
  const result = renderHook(() =>
    useGuardedSpecActions({ isCurrentViewLoading: false, ...actions }),
  );

  act(() => {
    invoke(result.current);
  });

  expect(actions[actionKey]).toHaveBeenCalledTimes(1);
  expect(actions[actionKey]).toHaveBeenCalledWith(...expectedArgs);
  result.unmount();
});

test.each(cases)("loading中は$labelがアクションを呼ばない", ({
  actionKey,
  invoke,
}) => {
  const actions = createActions();
  const result = renderHook(() =>
    useGuardedSpecActions({ isCurrentViewLoading: true, ...actions }),
  );

  act(() => {
    invoke(result.current);
  });

  expect(actions[actionKey]).not.toHaveBeenCalled();
  result.unmount();
});
