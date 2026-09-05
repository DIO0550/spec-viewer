import { expect, test } from "vitest";

import type { WorkspaceWorktrees } from "@/features/workspace/domain/worktree";
import { projectWorktreeTree } from "@/features/workspace/lib/projectWorktreeTree";

const source: WorkspaceWorktrees = {
  workspaceId: "workspace-a",
  worktrees: [
    {
      id: "agent-one",
      name: "Agent",
      categoryPath: ["Agents", "Active"],
      specs: [
        { id: "001", title: "Visible", isArchived: false },
        { id: "002", title: "Archived", isArchived: true },
      ],
      changedFiles: [
        { id: "a", path: "src/a.ts" },
        { id: "b", path: "src/b.ts" },
      ],
    },
    {
      id: "agent-two",
      name: "Agent",
      categoryPath: ["Agents"],
      specs: [],
      changedFiles: [],
    },
  ],
};

test("Specs は categoryPath を入力順の階層へ投影する", () => {
  expect(projectWorktreeTree(source, "specs")).toEqual([
    {
      kind: "category",
      id: "category:Agents",
      label: "Agents",
      children: [
        {
          kind: "category",
          id: "category:Agents/Active",
          label: "Active",
          children: [
            {
              kind: "worktree",
              id: "agent-one",
              label: "Agent",
              count: { kind: "spec-count", value: 1 },
            },
          ],
        },
        {
          kind: "worktree",
          id: "agent-two",
          label: "Agent",
          count: { kind: "spec-count", value: 0 },
        },
      ],
    },
  ]);
});

test("Diff は category 行を作らず変更ファイル件数を投影する", () => {
  expect(projectWorktreeTree(source, "diff")).toEqual([
    {
      kind: "worktree",
      id: "agent-one",
      label: "Agent",
      count: { kind: "changed-file-count", value: 2 },
    },
    {
      kind: "worktree",
      id: "agent-two",
      label: "Agent",
      count: { kind: "changed-file-count", value: 0 },
    },
  ]);
});

test("空の workspace は空の projection になる", () => {
  expect(
    projectWorktreeTree({ workspaceId: "empty", worktrees: [] }, "specs"),
  ).toEqual([]);
});

test("projection と入力の nested 参照は共有されない", () => {
  const projected = projectWorktreeTree(source, "specs");
  const firstCategory = projected[0];

  expect(firstCategory).not.toBe(source.worktrees[0]);
  expect(projected).not.toBe(source.worktrees);
  expect(source.worktrees[0]?.categoryPath).toEqual(["Agents", "Active"]);
});

test("1000 worktree の表示順を維持する", () => {
  const largeSource: WorkspaceWorktrees = {
    workspaceId: "large",
    worktrees: Array.from({ length: 1000 }, (_, index) => ({
      id: `worktree-${index}`,
      name: `Worktree ${index}`,
      categoryPath: ["Category " + index],
      specs: [],
      changedFiles: [],
    })),
  };

  const nodes = projectWorktreeTree(largeSource, "diff");
  const specsNodes = projectWorktreeTree(largeSource, "specs");

  expect(nodes).toHaveLength(1000);
  expect(specsNodes).toHaveLength(1000);
  expect(nodes[0]?.id).toBe("worktree-0");
  expect(nodes[999]?.id).toBe("worktree-999");
});

test("入力変更後とmutable出力copy変更後も既存projectionは不変である", () => {
  const mutableSource = {
    workspaceId: "mutable",
    worktrees: [
      {
        id: "worktree-a",
        name: "Original",
        categoryPath: ["Agents"],
        specs: [{ id: "spec-a", title: "Spec", isArchived: false }],
        changedFiles: [],
      },
    ],
  };
  const projected = projectWorktreeTree(mutableSource, "diff");
  const mutableOutputCopy = projected.map((node) => ({ ...node }));

  mutableSource.worktrees[0]!.name = "Changed input";
  mutableSource.worktrees[0]!.categoryPath.push("Nested");
  mutableOutputCopy[0] = {
    kind: "worktree",
    id: "changed-copy",
    label: "Changed copy",
    count: { kind: "changed-file-count", value: 99 },
  };

  expect(projected).toEqual([
    {
      kind: "worktree",
      id: "worktree-a",
      label: "Original",
      count: { kind: "changed-file-count", value: 0 },
    },
  ]);
});
