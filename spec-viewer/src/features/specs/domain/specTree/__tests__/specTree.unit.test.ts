import * as TestValues from "@/shared/testing/validatedValueObjects";
import { expect, test } from "vitest";

import type { SpecFile } from "@/features/specs/domain/specFile";
import type { SpecNode } from "@/features/specs/domain/specNode";
import { SpecTree } from "@/features/specs/domain/specTree";
import type { SpecTree as SpecTreeType } from "@/features/specs/domain/specTree";

const tasksFile: SpecFile = {
  key: "tasks",
  label: "Tasks",
  fileName: "tasks.md",
  status: "present",
};

const childNode: SpecNode = {
  id: TestValues.specId("root-spec/container/child-spec"),
  label: "Child Spec",
  kind: "spec",
  capabilities: { reviewable: true, archiveable: true },
  files: [tasksFile],
  children: [],
};

const rootNode: SpecNode = {
  id: TestValues.specId("root-spec"),
  label: "Root Spec",
  kind: "sourceGroup",
  capabilities: { reviewable: false, archiveable: false },
  files: [],
  children: [childNode],
};

const lockedNode: SpecNode = {
  id: TestValues.specId("locked-spec"),
  label: "Locked Spec",
  kind: "spec",
  capabilities: { reviewable: false, archiveable: false },
  files: [],
  children: [],
};

const tree: SpecTreeType = {
  specs: [rootNode, lockedNode],
};

test.each([
  [{ specs: [] }, true],
  [tree, false],
] as const)("SpecTree.isEmptyはtreeの空状態を判定する", (targetTree, expected) => {
  expect(SpecTree.isEmpty(targetTree)).toBe(expected);
});

test("SpecTree.findはSpecNode.findById相当の結果を返す", () => {
  expect(
    SpecTree.find(tree, TestValues.specId("root-spec/container/child-spec")),
  ).toBe(childNode);
  expect(SpecTree.find(tree, TestValues.specId("missing-spec"))).toBeNull();
});

test("SpecTree.defaultNodeはSpecNode.firstOpenable相当の結果を返す", () => {
  const emptyRoot: SpecNode = {
    id: TestValues.specId("empty-root"),
    label: "Empty Root",
    kind: "sourceGroup",
    capabilities: { reviewable: false, archiveable: false },
    files: [],
    children: [childNode],
  };

  expect(SpecTree.defaultNode({ specs: [emptyRoot] })).toBe(childNode);
});

test("SpecTree.resolveSelectionはpreferred specとfileが有効なら保持する", () => {
  expect(
    SpecTree.resolveSelection(tree, {
      specId: TestValues.specId("root-spec/container/child-spec"),
      fileKey: "tasks",
    }),
  ).toEqual({
    spec: childNode,
    fileKey: "tasks",
  });
});

test("SpecTree.resolveSelectionはfile削除時に同じspecの先頭fileKeyへfallbackする", () => {
  expect(
    SpecTree.resolveSelection(tree, {
      specId: TestValues.specId("root-spec/container/child-spec"),
      fileKey: "hearing",
    }),
  ).toEqual({
    spec: childNode,
    fileKey: "tasks",
  });
});

test("SpecTree.resolveSelectionはspec削除時にdefault nodeへfallbackする", () => {
  expect(
    SpecTree.resolveSelection(tree, {
      specId: TestValues.specId("missing-spec"),
      fileKey: "tasks",
    }),
  ).toEqual({
    spec: childNode,
    fileKey: "tasks",
  });
});

test("SpecTree.resolveSelectionはempty treeでnull selectionを返す", () => {
  expect(
    SpecTree.resolveSelection(
      { specs: [] },
      { specId: TestValues.specId("root-spec"), fileKey: "impl" },
    ),
  ).toEqual({
    spec: null,
    fileKey: null,
  });
});

test("SpecTree.ancestorIdsは選択nodeまでのancestor IDをroot順で返す", () => {
  expect(
    SpecTree.ancestorIds(
      tree,
      TestValues.specId("root-spec/container/child-spec"),
    ),
  ).toEqual([TestValues.specId("root-spec")]);
  expect(SpecTree.ancestorIds(tree, TestValues.specId("missing-spec"))).toEqual(
    [],
  );
});

test.each([
  ["root-spec", { canArchive: false, reason: "sourceGroup" }],
  ["root-spec/container/child-spec", { canArchive: true, reason: null }],
  ["locked-spec", { canArchive: false, reason: "notArchiveable" }],
  ["root-spec/container", { canArchive: false, reason: "container" }],
  ["missing-spec", { canArchive: false, reason: "unknown" }],
] as const)("SpecTree.archiveabilityは%sをnode capabilityとtree membershipから判定する", (specId, expected) => {
  expect(SpecTree.archiveability(tree, TestValues.specId(specId))).toEqual(
    expected,
  );
});
