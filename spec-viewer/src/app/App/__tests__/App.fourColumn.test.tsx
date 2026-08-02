import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test } from "vitest";

import App from "@/app/App";

test("Workspace pathbarは4カラム共通shellの全幅領域としてmode toolbarから分離される", () => {
  const container = document.createElement("div");
  const root = createRoot(container);

  act(() => {
    root.render(<App />);
  });

  const pathbar = container.querySelector(".app-shell__pathbar");
  const modeToolbar = container.querySelector(".app-shell__toolbar");

  expect(pathbar?.querySelector(".workspace-toolbar")).not.toBeNull();
  expect(pathbar?.textContent).toContain("リセット");
  expect(modeToolbar?.querySelector(".workspace-toolbar")).toBeNull();
  expect(modeToolbar?.querySelector(".view-mode-toolbar")).not.toBeNull();

  act(() => {
    root.unmount();
  });
});

test("workspace未選択ではDiffを無効化してSpecsと外側slotを保持する", () => {
  const container = document.createElement("div");
  const root = createRoot(container);

  act(() => {
    root.render(<App />);
  });

  const worktreesBefore = container.querySelector(".app-shell__worktrees");
  const commentsBefore = container.querySelector(".app-shell__comments");
  const diffTab = Array.from(
    container.querySelectorAll<HTMLButtonElement>('[role="tab"]'),
  ).find((button) => button.textContent === "Diff");

  act(() => {
    diffTab?.click();
  });

  expect(container.querySelector(".app-shell__worktrees")).toBe(
    worktreesBefore,
  );
  expect(container.querySelector(".app-shell__comments")).toBe(commentsBefore);
  expect(diffTab?.getAttribute("aria-disabled")).toBe("true");
  expect(diffTab?.title).toBe("ワークスペースを選択するとDiffを利用できます");
  expect(container.textContent).toContain("ワークスペースが選択されていません");
  expect(
    container.querySelector('aside[aria-label="Mode navigation"]'),
  ).not.toBeNull();

  act(() => {
    root.unmount();
  });
});
