import { expect, test } from "vitest";

import type { SpecFile } from "@/features/specs/domain/specFile";
import { SpecNode } from "@/features/specs/domain/specNode";
import { createSpecNodeFixture } from "@/features/specs/testing/specNodeFixture";

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

const nestedChild = createSpecNodeFixture({
  id: "child-spec",
  label: "Child Spec",
  files: [tasksFile],
});

const nodes = [
  createSpecNodeFixture({
    id: "root-category",
    label: "Root Category",
    kind: "category",
    children: [nestedChild],
  }),
  createSpecNodeFixture({
    id: "root-openable",
    label: "Root Openable",
    files: [implFile, tasksFile],
  }),
] as const;

test("SpecNode.findByIdはnested child nodeを見つける", () => {
  expect(SpecNode.findById(nodes, "child-spec")).toBe(nestedChild);
});

test("SpecNode.findByIdentityはsource groupが異なる同じrelative IDを区別する", () => {
  const first = createSpecNodeFixture({
    id: "primary/auth",
    label: "Auth",
    sourceGroupId: "primary",
    relativeId: "auth",
  });
  const second = createSpecNodeFixture({
    id: "secondary/auth",
    label: "Auth",
    sourceGroupId: "secondary",
    relativeId: "auth",
  });

  expect(
    SpecNode.findByIdentity([first, second], {
      sourceGroupId: "secondary",
      relativeId: "auth",
    }),
  ).toBe(second);
});

test.each([
  ["spec", true, true],
  ["category", false, false],
  ["archive", false, false],
  ["sourceGroup", false, false],
] as const)("kind=%sのopenable/archiveableを判定する", (kind, openable, archivable) => {
  const node = createSpecNodeFixture({ id: kind, label: kind, kind });

  expect(SpecNode.isOpenable(node)).toBe(openable);
  expect(SpecNode.isArchivable(node)).toBe(archivable);
});

test("SpecNode.countはspecの文書数とcontainerの子孫spec数を返す", () => {
  const spec = createSpecNodeFixture({
    id: "spec",
    label: "Spec",
    presentDocumentCount: 3,
  });
  const archive = createSpecNodeFixture({
    id: "archive",
    label: "Archive",
    kind: "archive",
    descendantSpecCount: 1,
  });

  expect(SpecNode.count(spec)).toBe(3);
  expect(SpecNode.count(archive)).toBe(1);
});

test("SpecNode.firstOpenableはcontainerをfallback選択しない", () => {
  expect(SpecNode.firstOpenable(nodes.slice(0, 1))).toBe(nestedChild);
  expect(
    SpecNode.firstOpenable([
      createSpecNodeFixture({
        id: "empty-category",
        label: "Empty Category",
        kind: "category",
      }),
    ]),
  ).toBeNull();
});

test("SpecNode.selectedFileとfile key helperはspecだけを対象にする", () => {
  expect(SpecNode.selectedFile(nodes[1], "tasks")).toBe(tasksFile);
  expect(SpecNode.firstFileKey(nodes[1])).toBe("impl");
  expect(SpecNode.firstFileKey(nodes[0])).toBeNull();
  expect(SpecNode.preservedFileKey(nodes[1], "tasks")).toBe("tasks");
  expect(SpecNode.preservedFileKey(nodes[1], "hearing")).toBe("impl");
  expect(SpecNode.preservedFileKey(nodes[0], "tasks")).toBeNull();
});
