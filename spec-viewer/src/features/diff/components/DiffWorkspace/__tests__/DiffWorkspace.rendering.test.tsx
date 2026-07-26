import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test } from "vitest";

import { DiffWorkspace } from "@/features/diff/components/DiffWorkspace";

test("DiffWorkspaceはChanges一覧とUnified差分を静的表示する", () => {
  const container = document.createElement("div");
  const root = createRoot(container);

  act(() => {
    root.render(<DiffWorkspace />);
  });

  expect(container.querySelector('aside[aria-label="Changes"]')).not.toBeNull();
  expect(
    container.querySelector('[aria-label="src/scorer.ts の差分"]'),
  ).not.toBeNull();
  expect(container.textContent).toContain("@@ -12,7 +12,15 @@");
  expect(container.querySelectorAll(".diff-code-line")).toHaveLength(15);
  expect(container.querySelector(".changes-tree__file button")).toBeNull();
  expect(container.querySelector(".diff-tabs button")).toBeNull();
  expect(container.querySelector(".diff-code-line button")).toBeNull();

  act(() => {
    root.unmount();
  });
});
