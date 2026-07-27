import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test } from "vitest";

import App from "@/app/App";

test("mode切替は外側WorktreesとCommentsを保持して中央2 slotだけを差し替える", () => {
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
  expect(container.textContent).toContain(
    "変更ファイル一覧はまだ利用できません。",
  );
  expect(container.textContent).toContain("Diffデータはまだ利用できません。");
  expect(
    container.querySelector('aside[aria-label="Mode navigation"]'),
  ).not.toBeNull();

  act(() => {
    root.unmount();
  });
});
