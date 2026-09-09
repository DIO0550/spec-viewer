import { expect, test } from "vitest";

import {
  NavigationHistory,
  NavigationHistoryKey,
} from "@/features/workspace/domain/navigationHistory";

test("空履歴へ保存した値を取得でき元履歴は未登録のまま", () => {
  const key = NavigationHistoryKey.create({
    workspaceId: "/ws",
    worktreeId: "main",
    mode: "specs",
  });
  const history = Object.freeze(NavigationHistory.empty<string>());
  const next = NavigationHistory.set(history, key, "spec-1");
  expect(NavigationHistory.get(next, key)).toBe("spec-1");
  expect(NavigationHistory.get(history, key)).toBeUndefined();
  expect(next).not.toBe(history);
});

const mainKey = NavigationHistoryKey.create({
  workspaceId: "/ws",
  worktreeId: "main",
  mode: "diff",
});
const otherKey = NavigationHistoryKey.create({
  workspaceId: "/ws",
  worktreeId: "other",
  mode: "diff",
});

test("空履歴は独立し未登録の読取で項目を追加しない", () => {
  const first = Object.freeze(NavigationHistory.empty<string>());
  const second = NavigationHistory.empty<string>();
  expect(first).not.toBe(second);
  expect(NavigationHistory.get(first, mainKey)).toBeUndefined();
  expect(NavigationHistory.get(first, mainKey)).toBeUndefined();
  expect(first).toEqual({});
});

test("保存済みnullは未登録のundefinedと区別する", () => {
  const saved = NavigationHistory.set(
    NavigationHistory.empty<string | null>(),
    mainKey,
    null,
  );
  expect(NavigationHistory.get(saved, mainKey)).toBeNull();
  expect(NavigationHistory.get(saved, otherKey)).toBeUndefined();
});

test("上書きは旧履歴と対象外の値参照を保持する", () => {
  const original = Object.freeze({ path: "a.ts" });
  const other = Object.freeze({ path: "b.ts" });
  const replacement = Object.freeze({ path: "c.ts" });
  const first = NavigationHistory.set(
    NavigationHistory.empty<Readonly<{ path: string }>>(),
    mainKey,
    original,
  );
  const before = Object.freeze(NavigationHistory.set(first, otherKey, other));
  const after = NavigationHistory.set(before, mainKey, replacement);
  expect(NavigationHistory.get(after, mainKey)).toBe(replacement);
  expect(NavigationHistory.get(after, otherKey)).toBe(other);
  expect(NavigationHistory.get(before, mainKey)).toBe(original);
  expect(after).not.toBe(before);
});

test.each([
  "spec-1",
  null,
  Object.freeze({ path: "a.ts" }),
])("同値保存も新履歴を返し格納値は複製しない: %j", (value) => {
  const history = NavigationHistory.set(
    NavigationHistory.empty<typeof value>(),
    mainKey,
    value,
  );
  const next = NavigationHistory.set(history, mainKey, value);
  expect(next).not.toBe(history);
  expect(NavigationHistory.get(next, mainKey)).toBe(value);
});

test("同じキーでも選択履歴とDiff履歴は独立して保存する", () => {
  const entry = Object.freeze({ activePath: "a.ts" });
  const selection = NavigationHistory.set(
    NavigationHistory.empty<string>(),
    mainKey,
    "a.ts",
  );
  const diff = NavigationHistory.set(
    NavigationHistory.empty<typeof entry>(),
    mainKey,
    entry,
  );
  const nextSelection = NavigationHistory.set(selection, mainKey, "b.ts");
  expect(NavigationHistory.get(nextSelection, mainKey)).toBe("b.ts");
  expect(NavigationHistory.get(diff, mainKey)).toBe(entry);
});
