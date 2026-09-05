import { expect, test } from "vitest";

import type { DiffLineCommentTarget } from "@/features/diffComments/components/DiffLineCommentControl";
import {
  createRangeCommentTarget,
  createRangeCommentTargetFromNode,
} from "@/features/diffComments/lib/createRangeCommentTarget";

const fallbackTarget: DiffLineCommentTarget = {
  key: "current:src/file.ts:7",
  side: "current",
  sidePath: "src/file.ts",
  oldPath: "src/file.ts",
  newPath: "src/file.ts",
  line: 7,
};

test("コードの複数行選択を開始行と終了行を持つコメント対象へ変換する", () => {
  const first = createLine("current", "src/file.ts", 4);
  const last = createLine("current", "src/file.ts", 7);

  expect(
    createRangeCommentTarget(createSelection(first, last), fallbackTarget),
  ).toEqual({
    ...fallbackTarget,
    key: "current:src/file.ts:7",
    line: 4,
    endLine: 7,
  });
});

test("下から上への選択も昇順の行範囲へ正規化する", () => {
  const first = createLine("current", "src/file.ts", 4);
  const last = createLine("current", "src/file.ts", 7);

  expect(
    createRangeCommentTarget(createSelection(last, first), fallbackTarget),
  ).toMatchObject({ line: 4, endLine: 7 });
});

test("コメントボタンのドラッグ先を行範囲targetへ変換する", () => {
  const last = createLine("current", "src/file.ts", 7);

  expect(createRangeCommentTargetFromNode(last, fallbackTarget)).toEqual({
    ...fallbackTarget,
    key: "current:src/file.ts:7",
    line: 7,
    endLine: undefined,
  });

  expect(
    createRangeCommentTargetFromNode(
      createLine("current", "src/file.ts", 4),
      fallbackTarget,
    ),
  ).toEqual({
    ...fallbackTarget,
    key: "current:src/file.ts:7",
    line: 4,
    endLine: 7,
  });
});

test("コメントボタンのドラッグ先が別sideなら範囲を更新しない", () => {
  const base = createLine("base", "src/file.ts", 4);

  expect(createRangeCommentTargetFromNode(base, fallbackTarget)).toBeNull();
});

test("別sideや別fileにまたがる選択は単一行対象のままにする", () => {
  const current = createLine("current", "src/file.ts", 4);
  const base = createLine("base", "src/file.ts", 7);

  expect(
    createRangeCommentTarget(createSelection(current, base), fallbackTarget),
  ).toEqual(fallbackTarget);
});

function createLine(
  side: "base" | "current",
  path: string,
  line: number,
): Text {
  const code = document.createElement("code");
  code.dataset.diffCommentLineContainer = "true";
  code.setAttribute(`data-diff-comment-${side}-path`, path);
  code.setAttribute(`data-diff-comment-${side}-line`, String(line));
  const text = document.createTextNode(`line ${line}`);
  code.append(text);
  document.body.append(code);
  return text;
}

function createSelection(anchorNode: Node, focusNode: Node): Selection {
  return {
    anchorNode,
    focusNode,
    isCollapsed: false,
  } as Selection;
}
