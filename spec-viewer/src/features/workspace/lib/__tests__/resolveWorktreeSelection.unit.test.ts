import { expect, test } from "vitest";

import {
  listWorktreeIdsDepthFirst,
  resolveWorktreeSelection,
} from "@/features/workspace/lib/resolveWorktreeSelection";
import type { WorktreeTreeNode } from "@/features/workspace/types/worktreeTreeNode";

const nodes: readonly WorktreeTreeNode[] = [
  {
    kind: "category",
    id: "category:a",
    label: "A",
    children: [
      {
        kind: "category",
        id: "category:a/b",
        label: "B",
        children: [
          {
            kind: "worktree",
            id: "nested",
            label: "Same",
            count: { kind: "spec-count", value: 0 },
          },
        ],
      },
    ],
  },
  {
    kind: "worktree",
    id: "root",
    label: "Same",
    count: { kind: "spec-count", value: 1 },
  },
];

test("worktree ID を depth-first pre-order で列挙する", () => {
  expect(listWorktreeIdsDepthFirst(nodes)).toEqual(["nested", "root"]);
});

test("preferred worktree が残る場合は選択を維持する", () => {
  expect(resolveWorktreeSelection(nodes, "root")).toBe("root");
});

test("preferred worktree が消えた場合は最初の leaf へ fallback する", () => {
  expect(resolveWorktreeSelection(nodes, "missing")).toBe("nested");
});

test("worktree がない場合は null になる", () => {
  expect(resolveWorktreeSelection([], "missing")).toBeNull();
});
