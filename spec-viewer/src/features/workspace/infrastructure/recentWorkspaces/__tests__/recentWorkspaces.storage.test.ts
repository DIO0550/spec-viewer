import { expect, test } from "vitest";

import {
  readRecentWorkspaces,
  recentWorkspaceLimit,
  readLastActiveWorkspacePath,
  recordRecentWorkspace,
  removeRecentWorkspace,
  writeLastActiveWorkspacePath,
  writeRecentWorkspaces,
  type RecentWorkspace,
  type RecentWorkspaceStorage,
} from "@/features/workspace/infrastructure/recentWorkspaces";
import { workspacePathFixture } from "@/features/workspace/testing/workspacePath";

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
      path: workspacePathFixture("/workspace/alpha"),
      displayName: "alpha",
      kind: "plugin-workspace",
      lastOpenedAt: "2026-05-01T00:00:00.000Z",
    },
    {
      path: workspacePathFixture("/workspace/beta"),
      displayName: "beta",
      kind: "spec-skill",
      lastOpenedAt: "2026-05-02T00:00:00.000Z",
    },
  ];

  const nextWorkspaces = recordRecentWorkspace(
    currentWorkspaces,
    {
      root: workspacePathFixture(" /workspace/beta "),
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
      path: workspacePathFixture(`/workspace/${index}`),
      displayName: String(index),
      kind: "plugin-workspace",
      lastOpenedAt: `2026-05-0${index}`,
    }),
  );

  const nextWorkspaces = recordRecentWorkspace(
    currentWorkspaces,
    {
      root: workspacePathFixture("/workspace/new"),
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
      path: workspacePathFixture("/workspace/alpha"),
      displayName: "alpha",
      kind: "plugin-workspace",
      lastOpenedAt: "2026-05-01T00:00:00.000Z",
    },
    {
      path: workspacePathFixture("/workspace/beta"),
      displayName: "beta",
      kind: "plugin-workspace",
      lastOpenedAt: "2026-05-02T00:00:00.000Z",
    },
  ];

  expect(
    removeRecentWorkspace(
      currentWorkspaces,
      workspacePathFixture("/workspace/alpha"),
    ),
  ).toEqual([
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

test("readRecentWorkspacesは保存済み値を正規化して読み込む", () => {
  const storage = new MemoryStorage();

  storage.setItem(
    "spec-reviewer.recent-workspaces",
    JSON.stringify([
      {
        path: " /workspace/alpha ",
        displayName: "Alpha Workspace",
        kind: "spec-skill",
        lastOpenedAt: "2026-05-01T00:00:00.000Z",
      },
      "/workspace/beta",
      { path: "/workspace/alpha", openedAt: "older" },
      { path: "", openedAt: "ignored" },
    ]),
  );

  expect(readRecentWorkspaces(storage)).toEqual([
    {
      path: workspacePathFixture("/workspace/alpha"),
      displayName: "Alpha Workspace",
      kind: "spec-skill",
      lastOpenedAt: "2026-05-01T00:00:00.000Z",
    },
    {
      path: "/workspace/beta",
      displayName: "beta",
      kind: "plugin-workspace",
      lastOpenedAt: "",
    },
  ]);
});

test("readRecentWorkspacesはlegacy pathとfile URLをcanonical pathで重複排除する", () => {
  const storage = new MemoryStorage();

  storage.setItem(
    "spec-reviewer.recent-workspaces",
    JSON.stringify([
      "file:///workspace/spec-viewer/",
      { path: "/workspace/spec-viewer", displayName: "duplicate" },
      "C:\\workspace\\other\\",
    ]),
  );

  expect(readRecentWorkspaces(storage)).toEqual([
    {
      path: "/workspace/spec-viewer",
      displayName: "spec-viewer",
      kind: "plugin-workspace",
      lastOpenedAt: "",
    },
    {
      path: "C:/workspace/other",
      displayName: "other",
      kind: "plugin-workspace",
      lastOpenedAt: "",
    },
  ]);
});

test("writeRecentWorkspacesはJSONとして保存する", () => {
  const storage = new MemoryStorage();
  const workspaces: readonly RecentWorkspace[] = [
    {
      path: workspacePathFixture("/workspace/alpha"),
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

  writeLastActiveWorkspacePath(
    workspacePathFixture(" /workspace/alpha "),
    storage,
  );

  expect(readLastActiveWorkspacePath(storage)).toBe("/workspace/alpha");
});

test("last active workspace pathはlegacy file URLをcanonical pathとして読み込む", () => {
  const storage = new MemoryStorage();

  storage.setItem(
    "spec-reviewer.last-active-workspace",
    "file:///workspace/spec%20viewer/",
  );

  expect(readLastActiveWorkspacePath(storage)).toBe("/workspace/spec viewer");
});
