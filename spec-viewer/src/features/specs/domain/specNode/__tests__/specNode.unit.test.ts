import * as TestValues from "@/shared/testing/validatedValueObjects";
import { expect, test } from "vitest";

import type { SpecFile } from "@/features/specs/domain/specFile";
import { SpecNode } from "@/features/specs/domain/specNode";
import type { SpecNode as SpecNodeType } from "@/features/specs/domain/specNode";

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

const nestedChild: SpecNodeType = {
  id: TestValues.specId("child-spec"),
  label: "Child Spec",
  files: [tasksFile],
  children: [],
};

const nodes: readonly SpecNodeType[] = [
  {
    id: TestValues.specId("root-empty"),
    label: "Root Empty",
    files: [],
    children: [nestedChild],
  },
  {
    id: TestValues.specId("root-openable"),
    label: "Root Openable",
    files: [implFile, tasksFile],
    children: [],
  },
];

test("SpecNode.findByIdはroot nodeを見つける", () => {
  expect(SpecNode.findById(nodes, TestValues.specId("root-openable"))).toBe(
    nodes[1],
  );
});

test("SpecNode.findByIdはnested child nodeを見つける", () => {
  expect(SpecNode.findById(nodes, TestValues.specId("child-spec"))).toBe(
    nestedChild,
  );
});

test("SpecNode.findByIdは存在しないidならnullを返す", () => {
  expect(
    SpecNode.findById(nodes, TestValues.specId("missing-spec")),
  ).toBeNull();
});

test("SpecNode.firstは先頭nodeを返す", () => {
  expect(SpecNode.first(nodes)).toBe(nodes[0]);
  expect(SpecNode.first([])).toBeNull();
});

test("SpecNode.firstOpenableはfileを持つ最初のnodeを返す", () => {
  expect(SpecNode.firstOpenable(nodes.slice(1))).toBe(nodes[1]);
});

test("SpecNode.firstOpenableはfileを持つchild nodeを返す", () => {
  expect(SpecNode.firstOpenable(nodes.slice(0, 1))).toBe(nestedChild);
});

test("SpecNode.firstOpenableはfileを持つnodeがなければ先頭nodeへfallbackする", () => {
  const emptyNodes: readonly SpecNodeType[] = [
    { id: TestValues.specId("root"), label: "Root", files: [], children: [] },
    {
      id: TestValues.specId("sibling"),
      label: "Sibling",
      files: [],
      children: [],
    },
  ];

  expect(SpecNode.firstOpenable(emptyNodes)).toBe(emptyNodes[0]);
});

test("SpecNode.selectedFileはnode内のfile key一致結果を返す", () => {
  expect(SpecNode.selectedFile(nodes[1], "tasks")).toBe(tasksFile);
  expect(SpecNode.selectedFile(nodes[1], "hearing")).toBeNull();
  expect(SpecNode.selectedFile(null, "tasks")).toBeNull();
});

test("SpecNode.firstFileKeyは先頭file keyを返す", () => {
  expect(SpecNode.firstFileKey(nodes[1])).toBe("impl");
  expect(SpecNode.firstFileKey(nodes[0])).toBeNull();
  expect(SpecNode.firstFileKey(null)).toBeNull();
});

test("SpecNode.preservedFileKeyは既存keyを保持し消えたkeyは先頭keyへfallbackする", () => {
  expect(SpecNode.preservedFileKey(nodes[1], "tasks")).toBe("tasks");
  expect(SpecNode.preservedFileKey(nodes[1], "hearing")).toBe("impl");
  expect(SpecNode.preservedFileKey(nodes[0], "tasks")).toBeNull();
});
