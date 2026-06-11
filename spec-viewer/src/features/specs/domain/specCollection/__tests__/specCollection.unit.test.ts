import { expect, test } from "vitest";

import { SpecCollection } from "@/features/specs/domain/specCollection";
import type { SpecFile, SpecNode } from "@/features/specs/types/spec";

function createFile(key: SpecFile["key"]): SpecFile {
  return {
    key,
    label: key,
    fileName: `${key}.md`,
    status: "present",
  };
}

function createNode(
  id: string,
  files: readonly SpecFile[] = [],
  children: readonly SpecNode[] = [],
): SpecNode {
  return { id, label: id, files, children };
}

const nestedSpecs: readonly SpecNode[] = [
  createNode("parent", [], [createNode("child", [createFile("design")])]),
  createNode("sibling", [createFile("requirements"), createFile("tasks")]),
];

test("findNodeはネストした子ノードを見つける", () => {
  expect(SpecCollection.findNode(nestedSpecs, "child")?.id).toBe("child");
});

test("findNodeは存在しないidに対してnullを返す", () => {
  expect(SpecCollection.findNode(nestedSpecs, "missing")).toBeNull();
});

test("findDefaultNodeはファイルを持つ最初のノードを返す", () => {
  expect(SpecCollection.findDefaultNode(nestedSpecs)?.id).toBe("child");
});

test("findDefaultNodeはファイルが無いとき先頭ノードへフォールバックする", () => {
  const specs = [createNode("first"), createNode("second")];

  expect(SpecCollection.findDefaultNode(specs)?.id).toBe("first");
});

test("findDefaultNodeは空のツリーに対してnullを返す", () => {
  expect(SpecCollection.findDefaultNode([])).toBeNull();
});

test("findFileは選択中のファイルを返す", () => {
  const spec = createNode("spec", [createFile("design"), createFile("tasks")]);

  expect(SpecCollection.findFile(spec, "tasks")?.key).toBe("tasks");
});

test.each([
  ["spec未選択", null, "design"],
  ["fileKey未選択", createNode("spec", [createFile("design")]), null],
] as const)("findFileは%sのときnullを返す", (_label, spec, fileKey) => {
  expect(SpecCollection.findFile(spec, fileKey)).toBeNull();
});

test("resolveReloadedSelectionは選択維持時に同じspecとfileKeyを保つ", () => {
  const selection = SpecCollection.resolveReloadedSelection({
    tree: { specs: nestedSpecs },
    preserveSelection: true,
    selectedSpecId: "sibling",
    selectedFileKey: "tasks",
  });

  expect(selection.spec?.id).toBe("sibling");
  expect(selection.fileKey).toBe("tasks");
});

test("resolveReloadedSelectionは消えたfileKeyを先頭ファイルへ置き換える", () => {
  const selection = SpecCollection.resolveReloadedSelection({
    tree: { specs: nestedSpecs },
    preserveSelection: true,
    selectedSpecId: "sibling",
    selectedFileKey: "design",
  });

  expect(selection.spec?.id).toBe("sibling");
  expect(selection.fileKey).toBe("requirements");
});

test("resolveReloadedSelectionは消えたspecをデフォルトspecへ置き換える", () => {
  const selection = SpecCollection.resolveReloadedSelection({
    tree: { specs: nestedSpecs },
    preserveSelection: true,
    selectedSpecId: "removed",
    selectedFileKey: "design",
  });

  expect(selection.spec?.id).toBe("child");
  expect(selection.fileKey).toBe("design");
});

test("resolveReloadedSelectionは選択維持なしのときデフォルト選択を返す", () => {
  const selection = SpecCollection.resolveReloadedSelection({
    tree: { specs: nestedSpecs },
    preserveSelection: false,
    selectedSpecId: "sibling",
    selectedFileKey: "tasks",
  });

  expect(selection.spec?.id).toBe("child");
  expect(selection.fileKey).toBe("design");
});

test("resolveReloadedSelectionは空ツリーのときspecもfileKeyもnullを返す", () => {
  const selection = SpecCollection.resolveReloadedSelection({
    tree: { specs: [] },
    preserveSelection: false,
    selectedSpecId: null,
    selectedFileKey: null,
  });

  expect(selection.spec).toBeNull();
  expect(selection.fileKey).toBeNull();
});
