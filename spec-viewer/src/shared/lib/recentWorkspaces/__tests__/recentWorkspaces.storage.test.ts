import { expect, test } from "vitest";

import {
  type RecentWorkspace,
  type RecentWorkspaceStorage,
  readLastActiveWorkspacePath,
  readRecentWorkspaces,
  recentWorkspaceLimit,
  recordRecentWorkspace,
  removeRecentWorkspace,
  writeLastActiveWorkspacePath,
  writeRecentWorkspaces,
} from "@/shared/lib/recentWorkspaces";

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

test("recordRecentWorkspaceは既存pathの位置を保ったまま内容を更新する", () => {
  const currentWorkspaces: readonly RecentWorkspace[] = [
    {
      path: "/workspace/alpha",
      displayName: "alpha",
      kind: "plugin-workspace",
      lastOpenedAt: "2026-05-01T00:00:00.000Z",
    },
    {
      path: "/workspace/beta",
      displayName: "beta",
      kind: "plugin-worktree",
      lastOpenedAt: "2026-05-02T00:00:00.000Z",
    },
  ];

  const nextWorkspaces = recordRecentWorkspace(
    currentWorkspaces,
    {
      root: " /workspace/beta ",
      kind: "plugin-workspace",
      files: [],
    },
    "2026-05-03T00:00:00.000Z",
  );

  expect(nextWorkspaces).toEqual([
    {
      path: "/workspace/alpha",
      displayName: "alpha",
      kind: "plugin-workspace",
      lastOpenedAt: "2026-05-01T00:00:00.000Z",
    },
    {
      path: "/workspace/beta",
      displayName: "beta",
      kind: "plugin-workspace",
      lastOpenedAt: "2026-05-03T00:00:00.000Z",
    },
  ]);
});

test("recordRecentWorkspaceは最大件数に切り詰める", () => {
  const currentWorkspaces = Array.from(
    { length: recentWorkspaceLimit },
    (_, index): RecentWorkspace => ({
      path: `/workspace/${index}`,
      displayName: String(index),
      kind: "plugin-workspace",
      lastOpenedAt: `2026-05-0${index}`,
    }),
  );

  const nextWorkspaces = recordRecentWorkspace(
    currentWorkspaces,
    {
      root: "/workspace/new",
      kind: "plugin-workspace",
      files: [],
    },
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
    {
      path: "/workspace/alpha",
      displayName: "alpha",
      kind: "plugin-workspace",
      lastOpenedAt: "2026-05-01T00:00:00.000Z",
    },
    {
      path: "/workspace/beta",
      displayName: "beta",
      kind: "plugin-workspace",
      lastOpenedAt: "2026-05-02T00:00:00.000Z",
    },
  ];

  expect(removeRecentWorkspace(currentWorkspaces, "/workspace/alpha")).toEqual([
    {
      path: "/workspace/beta",
      displayName: "beta",
      kind: "plugin-workspace",
      lastOpenedAt: "2026-05-02T00:00:00.000Z",
    },
  ]);
});

test("readRecentWorkspacesは壊れたstorage値を空配列として扱う", () => {
  const storage = new MemoryStorage();

  storage.setItem("spec-reviewer.recent-workspaces", "{");

  expect(readRecentWorkspaces(storage)).toEqual([]);
});

test("readRecentWorkspacesは全fieldが揃ったcurrent objectだけを読み込む", () => {
  const storage = new MemoryStorage();

  storage.setItem(
    "spec-reviewer.recent-workspaces",
    JSON.stringify([
      {
        path: " /workspace/alpha/ ",
        displayName: " Alpha Workspace ",
        kind: "plugin-worktree",
        lastOpenedAt: "2026-05-01T00:00:00.000Z",
      },
      "/workspace/string-entry",
      { path: "/workspace/opened-at", openedAt: "older" },
      {
        path: "/workspace/spec-skill",
        displayName: "spec-skill",
        kind: "spec-skill",
        lastOpenedAt: "2026-05-01T00:00:00.000Z",
      },
      {
        path: "/workspace/missing-kind",
        displayName: "missing-kind",
        lastOpenedAt: "2026-05-01T00:00:00.000Z",
      },
    ]),
  );

  expect(readRecentWorkspaces(storage)).toEqual([
    {
      path: "/workspace/alpha",
      displayName: "Alpha Workspace",
      kind: "plugin-worktree",
      lastOpenedAt: "2026-05-01T00:00:00.000Z",
    },
  ]);
});
test("writeRecentWorkspacesはJSONとして保存する", () => {
  const storage = new MemoryStorage();
  const workspaces: readonly RecentWorkspace[] = [
    {
      path: "/workspace/alpha",
      displayName: "alpha",
      kind: "plugin-workspace",
      lastOpenedAt: "2026-05-01T00:00:00.000Z",
    },
  ];

  writeRecentWorkspaces(workspaces, storage);

  expect(readRecentWorkspaces(storage)).toEqual(workspaces);
});

test("last active workspace pathは保存と読み込みでtrimされる", () => {
  const storage = new MemoryStorage();

  writeLastActiveWorkspacePath(" /workspace/alpha ", storage);

  expect(readLastActiveWorkspacePath(storage)).toBe("/workspace/alpha");
});
