import { expect, test } from "vitest";

import { SpecTreeView } from "@/features/specs/domain/specTreeView";
import type { SpecNode } from "@/features/specs/types/spec";

function createNode(id: string, children: readonly SpecNode[] = []): SpecNode {
  return { id, label: id, files: [], children };
}

const nestedSpecs: readonly SpecNode[] = [
  createNode("root", [createNode("parent", [createNode("leaf")])]),
  createNode("sibling"),
];

test("ancestorSpecIdsは選択ノード自身を除く祖先idを返す", () => {
  expect(SpecTreeView.ancestorSpecIds(nestedSpecs, "leaf")).toEqual([
    "root",
    "parent",
  ]);
});

test.each([
  ["ルートノード", "root"],
  ["存在しないid", "missing"],
] as const)("ancestorSpecIdsは%sのとき空配列を返す", (_label, selectedId) => {
  expect(SpecTreeView.ancestorSpecIds(nestedSpecs, selectedId)).toEqual([]);
});

test("withExpandedは既存の展開idを保ちながら追加する", () => {
  const next = SpecTreeView.withExpanded(new Set(["root"]), ["parent"]);

  expect([...next].sort()).toEqual(["parent", "root"]);
});

test("toggleExpandedは未展開のidを展開する", () => {
  expect(SpecTreeView.toggleExpanded(new Set(), "root").has("root")).toBe(true);
});

test("toggleExpandedは展開済みのidを折りたたむ", () => {
  expect(
    SpecTreeView.toggleExpanded(new Set(["root"]), "root").has("root"),
  ).toBe(false);
});

test.each([
  ["specs/feature-a", true],
  ["specs/.specs", false],
] as const)("isArchivableNodeはid=%sのとき%sを返す", (id, expected) => {
  expect(SpecTreeView.isArchivableNode(createNode(id))).toBe(expected);
});

test.each([
  [0, 10],
  [1, 26],
  [3, 58],
] as const)("itemIndentationは深さ%dで%dpxを返す", (depth, expected) => {
  expect(SpecTreeView.itemIndentation(depth)).toBe(expected);
});
