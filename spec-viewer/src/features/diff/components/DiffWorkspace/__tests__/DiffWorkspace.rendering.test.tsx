import { act, type ReactElement } from "react";
import { createRoot } from "react-dom/client";
import { expect, test } from "vitest";

import { DiffWorkspace } from "@/features/diff/components/DiffWorkspace";

test("DiffWorkspaceはcontrolled previewだけを中央表示する", () => {
  const result = renderDiff(
    <DiffWorkspace
      selectedPath="src/scorer.ts"
      preview={<pre>{"@@ -12,7 +12,15 @@"}</pre>}
      availability={{ status: "ready" }}
    />,
  );

  expect(
    result.container.querySelector('[aria-label="src/scorer.ts の差分"]'),
  ).not.toBeNull();
  expect(result.container.textContent).toContain("@@ -12,7 +12,15 @@");
  expect(
    result.container.querySelector('aside[aria-label="Changes"]'),
  ).toBeNull();
  result.unmount();
});

test.each([
  [
    "contract-pending",
    "Diff表示の契約を確認中です。Specsモードで仕様の確認を続けられます。",
  ],
  [
    "data-source-not-connected",
    "Diffデータはまだ利用できません。Specsモードで仕様の確認を続けられます。",
  ],
] as const)("DiffWorkspaceはunavailable理由 %s を通知する", (reason, message) => {
  const result = renderDiff(
    <DiffWorkspace
      selectedPath={null}
      preview={null}
      availability={{ status: "unavailable", reason }}
    />,
  );

  const status = result.container.querySelector('[role="status"]');
  expect(status?.getAttribute("aria-label")).toBe("Diffデータ状態");
  expect(status?.textContent).toBe(message);
  result.unmount();
});

test("DiffWorkspaceはready未選択を通知する", () => {
  const result = renderDiff(
    <DiffWorkspace
      selectedPath={null}
      preview={null}
      availability={{ status: "ready" }}
    />,
  );

  expect(result.container.querySelector('[role="status"]')?.textContent).toBe(
    "表示する変更ファイルを選択してください。",
  );
  result.unmount();
});

test("DiffWorkspaceはrevision selectorとpreviewを併存表示する", () => {
  const result = renderDiff(
    <DiffWorkspace
      state={{
        status: "ready",
        selectedPath: "tasks.md",
        preview: <pre>diff preview</pre>,
      }}
      selectedPath="tasks.md"
      preview={null}
      availability={{ status: "ready" }}
      revisionSelector={<button type="button">HEADと比較</button>}
    />,
  );

  expect(result.container.textContent).toContain("HEADと比較");
  expect(result.container.textContent).toContain("diff preview");
  result.unmount();
});

function renderDiff(element: ReactElement): Readonly<{
  container: HTMLDivElement;
  unmount: () => void;
}> {
  const container = document.createElement("div");
  const root = createRoot(container);
  act(() => {
    root.render(element);
  });

  return {
    container,
    unmount: () => {
      act(() => {
        root.unmount();
      });
    },
  };
}
