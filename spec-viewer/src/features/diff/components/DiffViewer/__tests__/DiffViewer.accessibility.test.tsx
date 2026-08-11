import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, test } from "vitest";

import { DiffViewer } from "@/features/diff/components/DiffViewer";
import { createDiffViewerFixture } from "@/features/diff/components/DiffViewer/testFixtures";

const mountedContainers: HTMLDivElement[] = [];

afterEach(() => {
  mountedContainers.splice(0).forEach((container) => container.remove());
});

test("DiffViewerは外部controlsを持たずdiff gridに意味のあるrole/nameを付ける", () => {
  const result = renderViewer(createDiffViewerFixture());

  expect(result.container.querySelector('[role="radiogroup"]')).toBeNull();
  expect(
    result.container.querySelector('[role="grid"][aria-label$="差分行"]'),
  ).not.toBeNull();
  expect(
    result.container.querySelector('[role="row"] [role="gridcell"]'),
  ).not.toBeNull();
  result.unmount();
});

test("DiffViewerのgridcellはside・kind・lineをscreen readerへ伝える", () => {
  const result = renderViewer(createDiffViewerFixture());
  const cell = result.container.querySelector(
    '[data-row-kind="content"] [role="gridcell"]',
  );

  expect(cell?.getAttribute("aria-label")).toContain("Unified");
  expect(cell?.getAttribute("aria-label")).toContain("旧行");
  expect(cell?.getAttribute("aria-label")).toContain("新行");
  expect(
    result.container
      .querySelector(".diff-viewer__marker")
      ?.getAttribute("aria-hidden"),
  ).toBe("true");
  result.unmount();
});

test("Splitのone-sided rowは対応行なしをaccessible labelで伝える", () => {
  const result = renderViewer(
    createDiffViewerFixture({
      status: "added",
      lines: [{ kind: "added", text: "const added = true;" }],
    }),
    "split",
  );

  expect(
    result.container
      .querySelector('[role="gridcell"][data-side="old"]')
      ?.getAttribute("aria-label"),
  ).toContain("対応する行なし");
  expect(
    result.container
      .querySelector('[role="gridcell"][data-side="new"]')
      ?.getAttribute("aria-label"),
  ).toContain("新ファイル");
  result.unmount();
});

function renderViewer(
  fileDiff = createDiffViewerFixture(),
  mode: "unified" | "split" = "unified",
): Readonly<{
  container: HTMLDivElement;
  unmount: () => void;
}> {
  const container = document.createElement("div");
  document.body.append(container);
  mountedContainers.push(container);
  const root = createRoot(container);
  act(() =>
    root.render(
      <DiffViewer
        fileDiff={fileDiff}
        mode={mode}
        activeChangeId={null}
        onActiveChangeIdChange={() => {}}
      />,
    ),
  );

  return {
    container,
    unmount: () => {
      act(() => root.unmount());
    },
  };
}

test("Splitのdeleted rowは新側の対応行なしをaccessible labelで伝える", () => {
  const result = renderViewer(
    createDiffViewerFixture({
      status: "deleted",
      lines: [{ kind: "removed", text: "const removed = true;" }],
    }),
    "split",
  );

  expect(
    result.container
      .querySelector('[role="gridcell"][data-side="new"]')
      ?.getAttribute("aria-label"),
  ).toContain("対応する行なし");
  result.unmount();
});

test.each([
  "binary",
  "largeFile",
  "diffLimit",
  "missingSide",
  "unsupportedEntryKind",
] as const)("safe state=%sはstatus announcementを表示する", (omissionReason) => {
  const result = renderViewer(createDiffViewerFixture({ omissionReason }));
  const status = result.container.querySelector('[role="status"]');

  expect(status?.textContent).toBeTruthy();
  expect(result.container.querySelector('[role="radiogroup"]')).toBeNull();
  result.unmount();
});
