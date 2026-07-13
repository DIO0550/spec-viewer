import { expect, test } from "vitest";

import {
  RecentWorkspaces,
  recentWorkspaceLimit,
  type RecentWorkspace,
} from "@/features/workspace/domain/recentWorkspaces";
import { workspacePathFixture } from "@/features/workspace/testing/workspacePath";

function recentWorkspace(path: string, lastOpenedAt: string): RecentWorkspace {
  const workspacePath = workspacePathFixture(path);

  return {
    path: workspacePath,
    displayName: path.split("/").slice(-1)[0] ?? path,
    kind: "plugin-workspace",
    lastOpenedAt,
  };
}

test("restoreはcanonical pathを重複排除し最大件数へ切り詰める", () => {
  const entries = Array.from({ length: recentWorkspaceLimit + 1 }, (_, index) =>
    recentWorkspace(
      `/workspace/${index}`,
      `2026-05-${String(index + 1).padStart(2, "0")}T00:00:00.000Z`,
    ),
  );
  const restored = RecentWorkspaces.restore({
    entries: [
      recentWorkspace("/workspace/0/", "2026-06-01T00:00:00.000Z"),
      ...entries,
    ],
    lastActiveWorkspacePath: workspacePathFixture("/workspace/0"),
  });
  expect(restored.entries).toHaveLength(recentWorkspaceLimit);
  expect(restored.entries[0]?.lastOpenedAt).toBe("2026-06-01T00:00:00.000Z");
  expect(
    restored.entries.filter(({ path }) => path === "/workspace/0"),
  ).toHaveLength(1);
  expect(restored.lastActiveWorkspacePath).toBe("/workspace/0");
});

test("restoreはtimestamp降順に並べてからduplicateを除外する", () => {
  const restored = RecentWorkspaces.restore({
    entries: [
      recentWorkspace("/workspace/alpha", "2026-05-01T00:00:00.000Z"),
      recentWorkspace("/workspace/beta", "2026-05-02T00:00:00.000Z"),
      recentWorkspace("/workspace/gamma", "2026-05-02T00:00:00.000Z"),
      recentWorkspace("/workspace/alpha/", "2026-05-03T00:00:00.000Z"),
    ],
    lastActiveWorkspacePath: workspacePathFixture("/workspace/alpha"),
  });

  expect(restored.entries.map(({ path }) => path)).toEqual([
    "/workspace/alpha",
    "/workspace/beta",
    "/workspace/gamma",
  ]);
  expect(restored.entries[0]?.lastOpenedAt).toBe("2026-05-03T00:00:00.000Z");
});

test("restoreはlimit後に一覧から外れたlast activeを破棄する", () => {
  const restored = RecentWorkspaces.restore({
    entries: Array.from({ length: recentWorkspaceLimit + 1 }, (_, index) =>
      recentWorkspace(
        `/workspace/${index}`,
        `2026-05-${String(index + 1).padStart(2, "0")}T00:00:00.000Z`,
      ),
    ),
    lastActiveWorkspacePath: workspacePathFixture("/workspace/0"),
  });

  expect(restored.entries[restored.entries.length - 1]?.path).toBe(
    "/workspace/1",
  );
  expect(restored.lastActiveWorkspacePath).toBeNull();
});

test("restoreは一覧にないlast activeを破棄する", () => {
  const restored = RecentWorkspaces.restore({
    entries: [recentWorkspace("/workspace/alpha", "2026-05-01")],
    lastActiveWorkspacePath: workspacePathFixture("/workspace/missing"),
  });

  expect(restored.lastActiveWorkspacePath).toBeNull();
});

test("recordは既存pathを最新として先頭へ移しlast activeを揃える", () => {
  const current = RecentWorkspaces.restore({
    entries: [
      recentWorkspace("/workspace/alpha", "2026-05-01"),
      recentWorkspace("/workspace/beta", "2026-05-02"),
    ],
    lastActiveWorkspacePath: workspacePathFixture("/workspace/alpha"),
  });
  const recorded = RecentWorkspaces.record(
    current,
    {
      root: workspacePathFixture(" /workspace/beta/ "),
      kind: "spec-skill",
      files: [],
    },
    "2026-05-03T00:00:00.000Z",
  );

  expect(recorded.entries).toEqual([
    {
      path: "/workspace/beta",
      displayName: "beta",
      kind: "spec-skill",
      lastOpenedAt: "2026-05-03T00:00:00.000Z",
    },
    recentWorkspace("/workspace/alpha", "2026-05-01"),
  ]);
  expect(recorded.lastActiveWorkspacePath).toBe("/workspace/beta");
});

test("recordは新しいpathを先頭へ加え最大件数を保つ", () => {
  const current = RecentWorkspaces.restore({
    entries: Array.from({ length: recentWorkspaceLimit }, (_, index) =>
      recentWorkspace(
        `/workspace/${index}`,
        `2026-05-${String(recentWorkspaceLimit - index).padStart(2, "0")}T00:00:00.000Z`,
      ),
    ),
    lastActiveWorkspacePath: workspacePathFixture("/workspace/0"),
  });
  const recorded = RecentWorkspaces.record(
    current,
    {
      root: workspacePathFixture("/workspace/new"),
      kind: "plugin-workspace",
      files: [],
    },
    "2026-06-01T00:00:00.000Z",
  );

  expect(recorded.entries).toHaveLength(recentWorkspaceLimit);
  expect(recorded.entries.map(({ path }) => path)).toEqual([
    "/workspace/new",
    "/workspace/0",
    "/workspace/1",
    "/workspace/2",
    "/workspace/3",
    "/workspace/4",
    "/workspace/5",
    "/workspace/6",
  ]);
});

test("recordはclockが後戻りしても新しいpathを先頭に保持する", () => {
  const futureTimestamp = "2099-01-01T00:00:00.000Z";
  const current = RecentWorkspaces.restore({
    entries: Array.from({ length: recentWorkspaceLimit }, (_, index) =>
      recentWorkspace(`/workspace/${index}`, futureTimestamp),
    ),
    lastActiveWorkspacePath: workspacePathFixture("/workspace/0"),
  });
  const recorded = RecentWorkspaces.record(
    current,
    {
      root: workspacePathFixture("/workspace/new"),
      kind: "plugin-workspace",
      files: [],
    },
    "2026-05-03T00:00:00.000Z",
  );

  expect(recorded.entries).toHaveLength(recentWorkspaceLimit);
  expect(recorded.entries[0]).toMatchObject({
    path: "/workspace/new",
    lastOpenedAt: futureTimestamp,
  });
  expect(recorded.lastActiveWorkspacePath).toBe("/workspace/new");
});

test("removeはlast activeのpathを削除したときlast activeも消去する", () => {
  const current = RecentWorkspaces.restore({
    entries: [
      recentWorkspace("/workspace/alpha", "2026-05-01"),
      recentWorkspace("/workspace/beta", "2026-05-02"),
    ],
    lastActiveWorkspacePath: workspacePathFixture("/workspace/alpha"),
  });
  const removed = RecentWorkspaces.remove(
    current,
    workspacePathFixture("file:///workspace/alpha/"),
  );

  expect(removed.entries.map(({ path }) => path)).toEqual(["/workspace/beta"]);
  expect(removed.lastActiveWorkspacePath).toBeNull();
});

test("removeは別pathの削除時にlast activeを保持する", () => {
  const current = RecentWorkspaces.restore({
    entries: [
      recentWorkspace("/workspace/alpha", "2026-05-01"),
      recentWorkspace("/workspace/beta", "2026-05-02"),
    ],
    lastActiveWorkspacePath: workspacePathFixture("/workspace/alpha"),
  });
  const removed = RecentWorkspaces.remove(
    current,
    workspacePathFixture("/workspace/beta"),
  );

  expect(removed.lastActiveWorkspacePath).toBe("/workspace/alpha");
});
