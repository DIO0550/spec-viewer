import { act, type ReactElement } from "react";
import { createRoot } from "react-dom/client";
import { expect, test } from "vitest";

import {
  DiffWorkspace,
  type DiffWorkspaceState,
} from "@/features/diff/components/DiffWorkspace";

test.each([
  [{ status: "loading" }, "読み込んでいます"],
  [{ status: "failed", message: "failed", onRetry: () => {} }, "failed"],
] as const)("file tabsはdetail stateが変わってもshell上部に残る", (state, expected) => {
  const view = renderWorkspace(state);

  expect(view.container.querySelector('[role="tablist"]')?.textContent).toBe(
    "open tabs",
  );
  expect(view.container.textContent).toContain(expected);
  view.unmount();
});

function renderWorkspace(
  state: DiffWorkspaceState,
): Readonly<{ container: HTMLDivElement; unmount: () => void }> {
  const container = document.createElement("div");
  const root = createRoot(container);
  const element: ReactElement = (
    <DiffWorkspace
      state={state}
      selectedPath="tasks.md"
      preview={null}
      availability={{ status: "ready" }}
      fileTabs={<div role="tablist">open tabs</div>}
    />
  );
  act(() => root.render(element));

  return {
    container,
    unmount: () => act(() => root.unmount()),
  };
}
