import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";
import {
  DiffWorkspace,
  type DiffWorkspaceState,
} from "@/features/diff/components/DiffWorkspace";

test.each([
  [{ status: "noSelection" }, "表示するSpecファイルを選択してください。"],
  [{ status: "unchanged" }, "選択中のファイルに変更はありません。"],
  [{ status: "loading" }, "差分を読み込んでいます。"],
] as const)("state=%sをaria-live statusで表示する", (state, message) => {
  const { container, unmount } = renderWorkspace(state);
  expect(container.querySelector('[role="status"]')?.textContent).toBe(message);
  unmount();
});

test("failedはretryを通知しreadyはcaller-owned previewを表示する", () => {
  const onRetry = vi.fn();
  const failed = renderWorkspace({
    status: "failed",
    message: "差分取得に失敗しました",
    onRetry,
  });
  act(() => {
    failed.container.querySelector<HTMLButtonElement>("button")?.click();
  });
  expect(onRetry).toHaveBeenCalledOnce();
  failed.unmount();

  const ready = renderWorkspace({
    status: "ready",
    selectedPath: "tasks.md",
    preview: <div data-testid="diff-viewer">preview</div>,
  });
  expect(ready.container.querySelector("[data-testid=diff-viewer]")).not.toBeNull();
  expect(ready.container.querySelector("section")?.getAttribute("aria-label")).toBe(
    "tasks.md の差分",
  );
  ready.unmount();
});

function renderWorkspace(state: DiffWorkspaceState): Readonly<{
  container: HTMLDivElement;
  unmount: () => void;
}> {
  const container = document.createElement("div");
  const root = createRoot(container);
  act(() => {
    root.render(
      <DiffWorkspace
        state={state}
        selectedPath={null}
        preview={null}
        availability={{ status: "ready" }}
      />,
    );
  });
  return {
    container,
    unmount: () => {
      act(() => root.unmount());
    },
  };
}
