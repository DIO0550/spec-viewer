import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test } from "vitest";

import { RepositoryDiffSummary } from "@/features/repositoryDiff/components/RepositoryDiffSummary";
import type { RepositoryDiffSummary as RepositoryDiffSummaryModel } from "@/features/repositoryDiff/domain/repositoryDiff";

function renderSummary(summary: RepositoryDiffSummaryModel): Readonly<{
  container: HTMLDivElement;
  unmount: () => void;
}> {
  const container = document.createElement("div");
  const root = createRoot(container);
  act(() => {
    root.render(<RepositoryDiffSummary summary={summary} />);
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

test("RepositoryDiffSummaryはAllのlogical totalとchanged subsetを表示する", () => {
  const result = renderSummary({
    filter: "all",
    totalPaths: 12,
    changedPaths: 4,
    statusCounts: { added: 1, modified: 2, deleted: 1 },
    ignoredDirectoryCount: 3,
  });

  expect(
    result.container.querySelector("section")?.getAttribute("aria-label"),
  ).toBe("差分サマリー");
  expect(result.container.textContent).toContain("全ファイル");
  expect(result.container.textContent).toContain("12 paths");
  expect(result.container.textContent).toContain("4");
  expect(result.container.textContent).toContain("3");
  expect(result.container.textContent).toContain("追加");
  expect(result.container.textContent).toContain("削除");
  result.unmount();
});

test("RepositoryDiffSummaryはChanged filterとstatus tokenを表示する", () => {
  const result = renderSummary({
    filter: "changed",
    totalPaths: 7,
    changedPaths: 7,
    statusCounts: {
      added: 1,
      modified: 1,
      deleted: 1,
      renamed: 1,
      copied: 1,
      typeChanged: 1,
      untracked: 1,
    },
    ignoredDirectoryCount: 0,
  });

  expect(result.container.textContent).toContain("変更ファイル");
  expect(result.container.textContent).toContain("7 paths");
  ["追加", "変更", "削除", "名前変更", "コピー", "種別変更", "未追跡"].forEach(
    (label) => {
      expect(result.container.textContent).toContain(label);
    },
  );
  result.unmount();
});
