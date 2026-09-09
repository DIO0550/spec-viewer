import { expect, test } from "vitest";

import {
  NavigationHistoryKey,
  type NavigationHistoryKeyInput,
} from "@/features/workspace/domain/navigationHistory";

test("履歴キーはworkspace・worktree・modeのJSON配列を保持する", () => {
  expect(
    NavigationHistoryKey.create({
      workspaceId: "/ws",
      worktreeId: "main",
      mode: "specs",
    }),
  ).toBe('["/ws","main","specs"]');
});

test.each([
  { workspaceId: "/other", worktreeId: "main", mode: "specs" },
  { workspaceId: "/ws", worktreeId: "other", mode: "specs" },
  { workspaceId: "/ws", worktreeId: "main", mode: "diff" },
] satisfies readonly NavigationHistoryKeyInput[])("識別要素の変更で別履歴になる: $workspaceId/$worktreeId/$mode", (input) => {
  const original = NavigationHistoryKey.create({
    workspaceId: "/ws",
    worktreeId: "main",
    mode: "specs",
  });
  expect(NavigationHistoryKey.create(input)).not.toBe(original);
});

test("区切り文字を含むIDでも要素の境界が衝突しない", () => {
  const first = NavigationHistoryKey.create({
    workspaceId: "a:b",
    worktreeId: "c",
    mode: "diff",
  });
  const second = NavigationHistoryKey.create({
    workspaceId: "a",
    worktreeId: "b:c",
    mode: "diff",
  });
  expect(first).not.toBe(second);
});

test.each([
  '"',
  "\\",
  "\n",
  "日本語",
  "🌲",
])("特殊文字を含むIDをそのまま保持する: %j", (id) => {
  const key = NavigationHistoryKey.create({
    workspaceId: id,
    worktreeId: id,
    mode: "diff",
  });
  expect(JSON.parse(key)).toEqual([id, id, "diff"]);
});

test.each([
  ["", "main", '["","main","specs"]'],
  ["/ws", "", '["/ws","","specs"]'],
  ["", "", '["","","specs"]'],
])("空IDを拒否・補完しない: %j/%j", (workspaceId, worktreeId, expected) => {
  expect(
    NavigationHistoryKey.create({ workspaceId, worktreeId, mode: "specs" }),
  ).toBe(expected);
});

test("入力を変更せず同値の別オブジェクトから同じキーを生成する", () => {
  const input = Object.freeze({
    workspaceId: "/ws",
    worktreeId: "main",
    mode: "diff",
  } satisfies NavigationHistoryKeyInput);
  expect(NavigationHistoryKey.create(input)).toBe(
    NavigationHistoryKey.create({ ...input }),
  );
  expect(input).toEqual({
    workspaceId: "/ws",
    worktreeId: "main",
    mode: "diff",
  });
});
