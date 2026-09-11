import { expect, test } from "vitest";

import { WorktreeTree } from "@/features/workspace/application/worktreeTree";
import type { Worktree } from "@/features/workspace/domain/worktree";

/**
 * Creates empty worktrees for category projection cases.
 * @param paths - Ordered category paths.
 * @returns Worktrees with stable numeric identifiers.
 */
function worktreesAt(paths: readonly (readonly string[])[]): Worktree[] {
  return paths.map((categoryPath, index) => ({
    id: String(index),
    name: "",
    categoryPath,
    specs: [],
    changedFiles: [],
  }));
}

test.each([
  { mode: "specs", kind: "spec-count" },
  { mode: "diff", kind: "changed-file-count" },
] as const)("カテゴリなしの空文字名を %s で保持する", ({ mode, kind }) => {
  expect(
    WorktreeTree.fromWorkspace(
      {
        workspaceId: "workspace",
        worktrees: worktreesAt([[]]),
      },
      mode,
    ),
  ).toEqual([
    { kind: "worktree", id: "0", label: "", count: { kind, value: 0 } },
  ]);
});

test("空文字カテゴリは空パスと区別し、Diff では平坦にする", () => {
  const source = { workspaceId: "workspace", worktrees: worktreesAt([[""]]) };
  expect(WorktreeTree.fromWorkspace(source, "specs")).toEqual([
    {
      kind: "category",
      id: "category:",
      label: "",
      children: [
        {
          kind: "worktree",
          id: "0",
          label: "",
          count: { kind: "spec-count", value: 0 },
        },
      ],
    },
  ]);
  expect(WorktreeTree.fromWorkspace(source, "diff")).toEqual([
    {
      kind: "worktree",
      id: "0",
      label: "",
      count: { kind: "changed-file-count", value: 0 },
    },
  ]);
});

test("特殊文字を含むカテゴリと多段パスは衝突しない", () => {
  const tree = WorktreeTree.fromWorkspace(
    {
      workspaceId: "workspace",
      worktrees: worktreesAt([["A/B"], ["A", "B"], ["% 日本語"]]),
    },
    "specs",
  );
  expect(tree).toMatchObject([
    { id: "category:A%2FB", label: "A/B", children: [{ id: "0" }] },
    {
      id: "category:A",
      label: "A",
      children: [{ id: "category:A/B", label: "B", children: [{ id: "1" }] }],
    },
    {
      id: "category:%25%20%E6%97%A5%E6%9C%AC%E8%AA%9E",
      label: "% 日本語",
      children: [{ id: "2" }],
    },
  ]);
});

test("同じ末尾ラベルは親ごとに分離し、再登場するカテゴリの順序を維持する", () => {
  const tree = WorktreeTree.fromWorkspace(
    {
      workspaceId: "workspace",
      worktrees: worktreesAt([
        ["A", "X"],
        ["B", "X"],
        ["A", "X"],
      ]),
    },
    "specs",
  );
  expect(tree).toMatchObject([
    {
      id: "category:A",
      children: [{ id: "category:A/X", children: [{ id: "0" }, { id: "2" }] }],
    },
    {
      id: "category:B",
      children: [{ id: "category:B/X", children: [{ id: "1" }] }],
    },
  ]);
});
