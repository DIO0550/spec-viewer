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
  expect(
    container.querySelector('aside[aria-label="仕様一覧"]'),
  ).not.toBeNull();
  expect(
    container.querySelector('aside[aria-label="Mode navigation"]'),
  ).not.toBeNull();
  expect(container.querySelector("main.app-shell__content")).not.toBeNull();
  expect(
    container.querySelector('aside[aria-label="コメントサイドバー"]'),
  ).not.toBeNull();
  expect(container.textContent).toContain(
    "Worktree データはまだ利用できません",
  );

  act(() => {
    root.unmount();
  });
});
