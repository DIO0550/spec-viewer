import { expect, test } from "vitest";

import type { SpecFile } from "@/features/specs/domain/specFile";
import { SpecTree } from "@/features/specs/domain/specTree";
import { createSpecNodeFixture } from "@/features/specs/testing/specNodeFixture";

const implFile: SpecFile = {
  key: "impl",
  label: "Implementation Plan",
  fileName: "implementation-plan.md",
  status: "present",
};

const childNode = createSpecNodeFixture({
  id: "primary/auth",
  label: "Auth",
  sourceGroupId: "primary",
  relativeId: "auth",
  files: [implFile],
});
const categoryNode = createSpecNodeFixture({
  id: "primary/planning",
  label: "Planning",
  kind: "category",
  sourceGroupId: "primary",
  relativeId: "planning",
  children: [childNode],
});
const archiveNode = createSpecNodeFixture({
  id: "primary/.archive",
  label: "Archive",
  kind: "archive",
  sourceGroupId: "primary",
  relativeId: ".archive",
});
const tree = { specs: [categoryNode, archiveNode] } as const;

test.each([
  [{ specs: [] }, true],
  [tree, false],
  [{ specs: [archiveNode] }, true],
] as const)("SpecTree.isEmptyはopenable specの有無を判定する", (target, expected) => {
  expect(SpecTree.isEmpty(target)).toBe(expected);
});

test("SpecTree.resolveSelectionはcontainerを選ばずspecへfallbackする", () => {
  expect(
    SpecTree.resolveSelection(tree, {
      specId: categoryNode.id,
      fileKey: null,
    }),
  ).toEqual({ spec: childNode, fileKey: "impl" });
});

test("SpecTree.resolveSelectionはcategory/archive/source groupだけならnullを返す", () => {
  const sourceGroup = createSpecNodeFixture({
    id: "secondary",
    label: "Secondary",
    kind: "sourceGroup",
    children: [archiveNode],
  });

  expect(
    SpecTree.resolveSelection(
      { specs: [categoryNode, archiveNode, sourceGroup].map((node) => ({ ...node, children: [] })) },
      { specId: archiveNode.id, fileKey: null },
    ),
  ).toEqual({ spec: null, fileKey: null });
});

test("SpecTree.findPathToNodeは複合identityで正しいancestor pathを返す", () => {
  const secondaryAuth = createSpecNodeFixture({
    id: "secondary/auth",
    label: "Auth",
    sourceGroupId: "secondary",
    relativeId: "auth",
  });
  const sourceGroup = createSpecNodeFixture({
    id: "secondary",
    label: "Secondary",
    kind: "sourceGroup",
    sourceGroupId: "secondary",
    relativeId: ".",
    children: [secondaryAuth],
  });
  const identityTree = { specs: [categoryNode, sourceGroup] } as const;

  expect(
    SpecTree.findPathToNode(identityTree, {
      sourceGroupId: "secondary",
      relativeId: "auth",
    }),
  ).toEqual([sourceGroup, secondaryAuth]);
  expect(
    SpecTree.findNodeByIdentity(identityTree, {
      sourceGroupId: "primary",
      relativeId: "auth",
    }),
  ).toBe(childNode);
});

test("SpecTree.resolveSelectionはpreferred specとfileが有効なら保持する", () => {
  expect(
    SpecTree.resolveSelection(tree, {
      specId: childNode.id,
      fileKey: "impl",
    }),
  ).toEqual({ spec: childNode, fileKey: "impl" });
});


test("SpecTreeは1000 nodeを追加IPCなしのpure projectionで走査する", () => {
  const specs = Array.from({ length: 1000 }, (_, index) =>
    createSpecNodeFixture({
      id: "primary/spec-" + index,
      label: "Spec " + index,
      sourceGroupId: "primary",
      relativeId: "spec-" + index,
      presentDocumentCount: index % 4,
    }),
  );
  const largeTree = { specs };

  expect(SpecTree.defaultNode(largeTree)).toBe(specs[0]);
  expect(
    SpecTree.findPathToNode(largeTree, {
      sourceGroupId: "primary",
      relativeId: "spec-999",
    }),
  ).toEqual([specs[999]]);
});
