import * as TestValues from "@/shared/testing/validatedValueObjects";
import { expect, test } from "vitest";

import type { SpecFile } from "@/features/specs/domain/specFile";
import type { SpecNode } from "@/features/specs/domain/specNode";
import { SpecTree } from "@/features/specs/domain/specTree";
import type { SpecTree as SpecTreeType } from "@/features/specs/domain/specTree";

const implFile: SpecFile = {
  key: "impl",
  label: "Implementation Plan",
  fileName: "implementation-plan.md",
  status: "present",
};

const tasksFile: SpecFile = {
  key: "tasks",
  label: "Tasks",
  fileName: "tasks.md",
  status: "present",
};

const childNode: SpecNode = {
  id: TestValues.specId("child-spec"),
  label: "Child Spec",
  files: [tasksFile],
  children: [],
};

const rootNode: SpecNode = {
  id: TestValues.specId("root-spec"),
  label: "Root Spec",
  files: [implFile, tasksFile],
  children: [childNode],
};

const tree: SpecTreeType = {
  specs: [rootNode],
};

test.each([
  [{ specs: [] }, true],
  [tree, false],
] as const)("SpecTree.isEmptyはtreeの空状態を判定する", (targetTree, expected) => {
  expect(SpecTree.isEmpty(targetTree)).toBe(expected);
});

test("SpecTree.findNodeはSpecNode.findById相当の結果を返す", () => {
  expect(SpecTree.findNode(tree, TestValues.specId("child-spec"))).toBe(
    childNode,
  );
  expect(SpecTree.findNode(tree, TestValues.specId("missing-spec"))).toBeNull();
});

test("SpecTree.defaultNodeはSpecNode.firstOpenable相当の結果を返す", () => {
  const emptyRoot: SpecNode = {
    id: TestValues.specId("empty-root"),
    label: "Empty Root",
    files: [],
    children: [childNode],
  };

  expect(SpecTree.defaultNode({ specs: [emptyRoot] })).toBe(childNode);
});

test("SpecTree.resolveSelectionはpreferred specとfileが有効なら保持する", () => {
  expect(
    SpecTree.resolveSelection(tree, {
      specId: TestValues.specId("root-spec"),
      fileKey: "tasks",
    }),
  ).toEqual({
    spec: rootNode,
    fileKey: "tasks",
  });
});

test("SpecTree.resolveSelectionはfile削除時に同じspecの先頭fileKeyへfallbackする", () => {
  expect(
    SpecTree.resolveSelection(tree, {
      specId: TestValues.specId("root-spec"),
      fileKey: "hearing",
    }),
  ).toEqual({
    spec: rootNode,
    fileKey: "impl",
  });
});

test("SpecTree.resolveSelectionはspec削除時にdefault nodeへfallbackする", () => {
  expect(
    SpecTree.resolveSelection(tree, {
      specId: TestValues.specId("missing-spec"),
      fileKey: "tasks",
    }),
  ).toEqual({
    spec: rootNode,
    fileKey: "impl",
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
