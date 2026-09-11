import { expect, test } from "vitest";

import { Worktree } from "../worktree";

const worktree: Worktree = {
  id: "agent",
  name: "Agent",
  categoryPath: ["Agents"],
  specs: [
    { id: "a", title: "Active", isArchived: false },
    { id: "b", title: "Archived", isArchived: true },
    { id: "c", title: "Active", isArchived: false },
  ],
  changedFiles: [
    { id: "a", path: "a.ts" },
    { id: "b", path: "b.ts" },
  ],
};

test.each([
  { specs: worktree.specs, expected: 2 },
  { specs: [], expected: 0 },
  {
    specs: worktree.specs.map((spec) => ({ ...spec, isArchived: true })),
    expected: 0,
  },
])("非アーカイブの Spec 数を返す: $expected", ({ specs, expected }) => {
  expect(Worktree.countActiveSpecs({ ...worktree, specs })).toBe(expected);
});

test.each([0, 1, 2])("変更ファイルの登録数 %i を返す", (count) => {
  expect(
    Worktree.countChangedFiles({
      ...worktree,
      changedFiles: worktree.changedFiles.slice(0, count),
    }),
  ).toBe(count);
});

test("繰り返し集計しても入力を変更しない", () => {
  const before = structuredClone(worktree);

  expect(Worktree.countActiveSpecs(worktree)).toBe(2);
  expect(Worktree.countChangedFiles(worktree)).toBe(2);
  expect(Worktree.countActiveSpecs(worktree)).toBe(2);
  expect(Worktree.countChangedFiles(worktree)).toBe(2);
  expect(worktree).toEqual(before);
});
