import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test } from "vitest";

import { CurrentFileViewer } from "@/features/diff/components/CurrentFileViewer";
import { createDiffViewerFixture } from "@/features/diff/components/DiffViewer/testFixtures";

function renderViewer(
  fileDiff = createDiffViewerFixture({ newContent: "first\nsecond" }),
): Readonly<{ container: HTMLDivElement; unmount: () => void }> {
  const container = document.createElement("div");
  const root = createRoot(container);
  act(() => root.render(<CurrentFileViewer fileDiff={fileDiff} />));
  return {
    container,
    unmount: () => act(() => root.unmount()),
  };
}

test("current内容を行番号付きread-only codeとして表示する", () => {
  const view = renderViewer();
  const rows = view.container.querySelectorAll(".current-file-viewer__row");

  expect(rows).toHaveLength(2);
  expect(rows[0]?.textContent).toBe("1first");
  expect(rows[1]?.textContent).toBe("2second");
  expect(view.container.querySelector('[role="textbox"]')).toBeNull();
  expect(view.container.querySelector("textarea")).toBeNull();
  view.unmount();
});

test("availableな空文字は空のファイルと表示する", () => {
  const view = renderViewer(
    createDiffViewerFixture({ newContent: "", lines: [] }),
  );

  expect(view.container.textContent).toContain("空のファイルです。");
  view.unmount();
});

test("deletedはold contentを表示せずcurrent側なしを示す", () => {
  const view = renderViewer(
    createDiffViewerFixture({
      status: "deleted",
      oldContent: "old",
      hunks: [
        {
          header: "@@ -1 +0,0 @@",
          lines: [
            {
              kind: "removed",
              text: "old",
              oldLineNumber: 1,
              newLineNumber: null,
            },
          ],
        },
      ],
    }),
  );

  expect(view.container.textContent).toContain("current側の内容がありません。");
  expect(view.container.textContent).not.toContain("old");
  view.unmount();
});

test.each([
  ["binary", "バイナリファイルは表示できません。"],
  ["largeFile", "ファイルが大きすぎるため表示できません。"],
  ["diffLimit", "表示上限を超えています。"],
  ["missingSide", "current側の内容がありません。"],
  ["unsupportedEntryKind", "このファイル種類は表示できません。"],
] as const)("omitted %sを理由別statusで表示する", (reason, message) => {
  const base = createDiffViewerFixture();
  const fileDiff = {
    ...base,
    review: {
      ...base.review,
      newContent: {
        state: "omitted" as const,
        text: null,
        reason,
        byteLength: null,
      },
    },
  };
  const view = renderViewer(fileDiff);

  expect(view.container.querySelector('[role="status"]')?.textContent).toBe(
    message,
  );
  view.unmount();
});
