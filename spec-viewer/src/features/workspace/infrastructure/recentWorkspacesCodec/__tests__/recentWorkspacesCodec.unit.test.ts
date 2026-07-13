import { expect, test } from "vitest";

import { recentWorkspaceLimit } from "@/features/workspace/domain/recentWorkspaces";
import {
  decodeRecentWorkspaces,
  encodeRecentWorkspaces,
} from "@/features/workspace/infrastructure/recentWorkspacesCodec";
import { workspacePathFixture } from "@/features/workspace/testing/workspacePath";

test("decodeはcurrentとlegacy entryをcanonicalなaggregateへ移行する", () => {
  const decoded = decodeRecentWorkspaces({
    entriesJson: JSON.stringify([
      {
        path: " /workspace/alpha/ ",
        displayName: " Alpha Workspace ",
        kind: "spec-skill",
        lastOpenedAt: "2026-05-03T00:00:00.000Z",
      },
      "file:///workspace/beta/",
      {
        path: "/workspace/gamma",
        openedAt: "2026-05-01T00:00:00.000Z",
      },
      { path: "/workspace/alpha", displayName: "duplicate" },
    ]),
    lastActiveWorkspacePath: "file:///workspace/beta/",
  });

  expect(decoded).toEqual({
    entries: [
      {
        path: "/workspace/alpha",
        displayName: "Alpha Workspace",
        kind: "spec-skill",
        lastOpenedAt: "2026-05-03T00:00:00.000Z",
      },
      {
        path: "/workspace/gamma",
        displayName: "gamma",
        kind: "plugin-workspace",
        lastOpenedAt: "2026-05-01T00:00:00.000Z",
      },
      {
        path: "/workspace/beta",
        displayName: "beta",
        kind: "plugin-workspace",
        lastOpenedAt: "",
      },
    ],
    lastActiveWorkspacePath: "/workspace/beta",
  });
});

test.each([
  null,
  "{",
  JSON.stringify({ entries: [] }),
  JSON.stringify(42),
])("decodeは壊れたentries JSON %sを空aggregateとして扱う", (entriesJson) => {
  const decoded = decodeRecentWorkspaces({
    entriesJson,
    lastActiveWorkspacePath: "/workspace/alpha",
  });

  expect(decoded).toEqual({
    entries: [],
    lastActiveWorkspacePath: null,
  });
});

test("decodeは不正entryを無視しaggregateの最大件数を適用する", () => {
  const entries = Array.from(
    { length: recentWorkspaceLimit + 2 },
    (_, index) => ({
      path: `/workspace/${index}`,
      kind: "plugin-workspace",
      lastOpenedAt: `2026-05-${String(index + 1).padStart(2, "0")}T00:00:00.000Z`,
    }),
  );
  const decoded = decodeRecentWorkspaces({
    entriesJson: JSON.stringify([null, { path: "" }, ...entries]),
    lastActiveWorkspacePath: "/workspace/0",
  });

  expect(decoded.entries).toHaveLength(recentWorkspaceLimit);
  expect(decoded.entries[decoded.entries.length - 1]?.path).toBe(
    "/workspace/2",
  );
  expect(decoded.lastActiveWorkspacePath).toBeNull();
});

test("decodeは非空の不正timestampを持つentryを除外する", () => {
  const decoded = decodeRecentWorkspaces({
    entriesJson: JSON.stringify([
      {
        path: "/workspace/invalid-current",
        lastOpenedAt: "2026-02-30T00:00:00.000Z",
      },
      {
        path: "/workspace/invalid-legacy",
        openedAt: "not-a-timestamp",
      },
      "/workspace/timestampless-legacy",
    ]),
    lastActiveWorkspacePath: "/workspace/timestampless-legacy",
  });

  expect(decoded).toEqual({
    entries: [
      {
        path: "/workspace/timestampless-legacy",
        displayName: "timestampless-legacy",
        kind: "plugin-workspace",
        lastOpenedAt: "",
      },
    ],
    lastActiveWorkspacePath: "/workspace/timestampless-legacy",
  });
});

test("encodeはcurrent storage形式を維持する", () => {
  const encoded = encodeRecentWorkspaces({
    entries: [
      {
        path: workspacePathFixture("/workspace/alpha"),
        displayName: "alpha",
        kind: "plugin-worktree",
        lastOpenedAt: "2026-05-03T00:00:00.000Z",
      },
    ],
    lastActiveWorkspacePath: workspacePathFixture("/workspace/alpha"),
  });

  expect(JSON.parse(encoded.entriesJson)).toEqual([
    {
      path: "/workspace/alpha",
      displayName: "alpha",
      kind: "plugin-worktree",
      lastOpenedAt: "2026-05-03T00:00:00.000Z",
    },
  ]);
  expect(encoded.lastActiveWorkspacePath).toBe("/workspace/alpha");
});
