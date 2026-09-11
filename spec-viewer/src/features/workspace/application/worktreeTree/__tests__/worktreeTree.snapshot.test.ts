import { expect, test } from "vitest";

import { WorktreeTree } from "@/features/workspace/application/worktreeTree";
import type { WorktreeTreeNode } from "@/features/workspace/types/worktreeTreeNode";

/**
 * Collects all object references in a projection for isolation assertions.
 * @param nodes - Root or child nodes to traverse.
 * @returns Arrays, nodes, and counts in traversal order.
 */
function references(nodes: readonly WorktreeTreeNode[]): readonly object[] {
  return [
    nodes,
    ...nodes.flatMap((node) =>
      node.kind === "category"
        ? [node, ...references(node.children)]
        : [node, node.count],
    ),
  ];
}

test.each([
  "specs",
  "diff",
] as const)("%s の投影は入力と過去の結果から分離する", (mode) => {
  const worktree = {
    id: "a",
    name: "Original",
    categoryPath: ["A", "X"],
    specs: [{ id: "s", title: "Spec", isArchived: false }],
    changedFiles: [{ id: "f", path: "f.ts" }],
  };
  const source = { workspaceId: "workspace", worktrees: [worktree] };
  const before = structuredClone(source);
  const first = WorktreeTree.fromWorkspace(source, mode);
  const snapshot = structuredClone(first);
  const second = WorktreeTree.fromWorkspace(source, mode);

  expect(source).toEqual(before);
  expect(first).toEqual(second);
  const firstReferences = references(first);
  const secondReferences = references(second);
  firstReferences.forEach((reference, index) => {
    expect(reference).not.toBe(secondReferences[index]);
  });

  worktree.name = "Changed";
  worktree.categoryPath.push("Nested");
  worktree.specs.push({ id: "s2", title: "Another", isArchived: false });
  worktree.changedFiles.push({ id: "f2", path: "f2.ts" });
  expect(first).toEqual(snapshot);
  expect(second).toEqual(snapshot);
});
