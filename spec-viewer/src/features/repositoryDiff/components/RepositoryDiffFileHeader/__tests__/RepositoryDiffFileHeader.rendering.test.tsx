import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test } from "vitest";

import { RepositoryDiffFileHeader } from "@/features/repositoryDiff/components/RepositoryDiffFileHeader";

function renderHeader(
  summary: Readonly<{ additions: number; deletions: number }> | null,
): Readonly<{ container: HTMLDivElement; unmount: () => void }> {
  const container = document.createElement("div");
  const root = createRoot(container);
  act(() =>
    root.render(
      <RepositoryDiffFileHeader
        path="src/very/long/file.ts"
        change="renamed"
        baseIdentifier="abcdef0"
        currentIdentifier="rs1_12345678"
        summary={summary}
      />,
    ),
  );
  return {
    container,
    unmount: () => act(() => root.unmount()),
  };
}

test("path・status・base/current・line summaryを表示する", () => {
  const view = renderHeader({ additions: 12, deletions: 3 });

  expect(view.container.textContent).toContain("src/very/long/file.ts");
  expect(view.container.textContent).toContain("R 名前変更");
  expect(view.container.textContent).toContain("base abcdef0");
  expect(view.container.textContent).toContain("current rs1_12345678");
  expect(view.container.textContent).toContain("+12");
  expect(view.container.textContent).toContain("-3");
  view.unmount();
});

test("summary欠落時はline countを表示しない", () => {
  const view = renderHeader(null);

  expect(view.container.textContent).not.toContain("+");
  expect(view.container.textContent).not.toContain("-");
  view.unmount();
});
