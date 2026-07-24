import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test } from "vitest";

import App from "@/app/App";

test("Appはworkspace未選択の初期状態を表示する", () => {
  const container = document.createElement("div");
  const root = createRoot(container);

  act(() => {
    root.render(<App />);
  });

  expect(container.textContent).toContain("Spec Reviewer");
  expect(container.textContent).toContain("ワークスペースが選択されていません");

  act(() => {
    root.unmount();
  });
});

test("AppはAI適用プレビューのhash routeで別ページを表示する", () => {
  const originalHash = window.location.hash;
  window.location.hash = "#/apply-ai-diff-preview/tasks";
  const container = document.createElement("div");
  const root = createRoot(container);

  act(() => {
    root.render(<App />);
  });

  expect(container.textContent).toContain("tasks.md");
  expect(container.textContent).toContain("レビュー画面へ戻る");
  expect(container.textContent).toContain("Splitで並べて確認");
  expect(
    container.querySelector('[aria-label="古い内容と新しい内容の表示領域"]'),
  ).not.toBeNull();

  act(() => {
    root.unmount();
  });
  window.location.hash = originalHash;
});
