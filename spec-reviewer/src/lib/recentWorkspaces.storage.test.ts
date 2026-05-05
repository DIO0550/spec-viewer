import { expect, test } from "vitest";

import {
  readRecentWorkspaces,
  recentWorkspaceLimit,
  recordRecentWorkspace,
  removeRecentWorkspace,
  writeRecentWorkspaces,
  type RecentWorkspace,
  type RecentWorkspaceStorage,
} from "./recentWorkspaces";

class MemoryStorage implements RecentWorkspaceStorage {
  private readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

test("recordRecentWorkspaceはtrimしたpathを先頭に追加して重複を除く", () => {
  const currentWorkspaces: readonly RecentWorkspace[] = [
    { path: "/workspace/alpha", openedAt: "2026-05-01T00:00:00.000Z" },
    { path: "/workspace/beta", openedAt: "2026-05-02T00:00:00.000Z" },
  ];

  const nextWorkspaces = recordRecentWorkspace(
    currentWorkspaces,
    " /workspace/beta ",
    "2026-05-03T00:00:00.000Z",
  );

  expect(nextWorkspaces).toEqual([
    { path: "/workspace/beta", openedAt: "2026-05-03T00:00:00.000Z" },
    { path: "/workspace/alpha", openedAt: "2026-05-01T00:00:00.000Z" },
  ]);
});

test("recordRecentWorkspaceは最大件数に切り詰める", () => {
  const currentWorkspaces = Array.from(
    { length: recentWorkspaceLimit },
    (_, index): RecentWorkspace => ({
      path: `/workspace/${index}`,
      openedAt: `2026-05-0${index}`,
    }),
  );

  const nextWorkspaces = recordRecentWorkspace(
    currentWorkspaces,
    "/workspace/new",
    "2026-05-05T00:00:00.000Z",
  );

  expect(nextWorkspaces).toHaveLength(recentWorkspaceLimit);
  expect(nextWorkspaces[0]?.path).toBe("/workspace/new");
  expect(nextWorkspaces[nextWorkspaces.length - 1]?.path).toBe(
    `/workspace/${recentWorkspaceLimit - 2}`,
  );
});

test("removeRecentWorkspaceは指定pathだけを削除する", () => {
  const currentWorkspaces: readonly RecentWorkspace[] = [
    { path: "/workspace/alpha", openedAt: "2026-05-01T00:00:00.000Z" },
    { path: "/workspace/beta", openedAt: "2026-05-02T00:00:00.000Z" },
  ];

  expect(removeRecentWorkspace(currentWorkspaces, "/workspace/alpha")).toEqual([
    { path: "/workspace/beta", openedAt: "2026-05-02T00:00:00.000Z" },
  ]);
});

test("readRecentWorkspacesは壊れたstorage値を空配列として扱う", () => {
  const storage = new MemoryStorage();

  storage.setItem("spec-reviewer.recent-workspaces", "{");

  expect(readRecentWorkspaces(storage)).toEqual([]);
});

test("readRecentWorkspacesは保存済み値を正規化して読み込む", () => {
  const storage = new MemoryStorage();

  storage.setItem(
    "spec-reviewer.recent-workspaces",
    JSON.stringify([
      { path: " /workspace/alpha ", openedAt: "2026-05-01T00:00:00.000Z" },
      "/workspace/beta",
      { path: "/workspace/alpha", openedAt: "older" },
      { path: "", openedAt: "ignored" },
    ]),
  );

  expect(readRecentWorkspaces(storage)).toEqual([
    { path: "/workspace/alpha", openedAt: "2026-05-01T00:00:00.000Z" },
    { path: "/workspace/beta", openedAt: "" },
  ]);
});

test("writeRecentWorkspacesはJSONとして保存する", () => {
  const storage = new MemoryStorage();
  const workspaces: readonly RecentWorkspace[] = [
    { path: "/workspace/alpha", openedAt: "2026-05-01T00:00:00.000Z" },
  ];

  writeRecentWorkspaces(workspaces, storage);

  expect(readRecentWorkspaces(storage)).toEqual(workspaces);
});
