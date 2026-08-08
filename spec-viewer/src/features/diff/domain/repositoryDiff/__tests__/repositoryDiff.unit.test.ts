import { expect, test } from "vitest";

import {
  BaseResolution,
  RepositoryCurrentSnapshotId,
  RepositoryDiffOverview,
  type RepositoryDiffOverview as RepositoryDiffOverviewValue,
  RepositoryId,
  RepositoryIgnoredCursor,
  RepositoryNodeId,
  RepositoryTreeNode,
  type RepositoryTreeNode as RepositoryTreeNodeValue,
  RepositoryWorktreeId,
} from "@/features/diff/domain/repositoryDiff";

const ID_COMPANIONS = [
  [
    "RepositoryWorktreeId",
    (raw: string) =>
      RepositoryWorktreeId.toString(RepositoryWorktreeId.fromString(raw)),
    "/repo/worktree",
  ],
  [
    "RepositoryId",
    (raw: string) => RepositoryId.toString(RepositoryId.fromString(raw)),
    `rr1_${"a".repeat(64)}`,
  ],
  [
    "RepositoryCurrentSnapshotId",
    (raw: string) =>
      RepositoryCurrentSnapshotId.toString(
        RepositoryCurrentSnapshotId.fromString(raw),
      ),
    "rs1_snapshot",
  ],
  [
    "RepositoryNodeId",
    (raw: string) =>
      RepositoryNodeId.toString(RepositoryNodeId.fromString(raw)),
    `in1_${"b".repeat(64)}`,
  ],
  [
    "RepositoryIgnoredCursor",
    (raw: string) =>
      RepositoryIgnoredCursor.toString(RepositoryIgnoredCursor.fromString(raw)),
    "ic1_offset_200",
  ],
] as const;

const resolvedBase = {
  state: "resolved",
  source: "originHead",
  branchRef: "refs/remotes/origin/main",
  mergeBaseSha: "a".repeat(40),
  headSha: "b".repeat(40),
} as const satisfies BaseResolution;

const needsSelectionBase = {
  state: "needsSelection",
  reason: "unbornHead",
  candidates: [],
} as const satisfies BaseResolution;

const invalidOverrideBase = {
  state: "invalidOverride",
  reason: "missingRef",
  overrideRef: "refs/heads/missing",
} as const satisfies BaseResolution;

/**
 * Builds a tree node with the given overrides applied.
 *
 * @param overrides - Fields to override on the default directory node.
 * @returns A complete readonly tree node.
 */
function createTreeNode(
  overrides: Partial<RepositoryTreeNodeValue> = {},
): RepositoryTreeNodeValue {
  return {
    path: "src",
    name: "src",
    kind: "directory",
    entryKind: null,
    change: null,
    ignored: false,
    children: { state: "loaded", items: [] },
    ...overrides,
  };
}

/**
 * Builds an overview around the given base resolution and snapshot.
 *
 * @param base - The base branch resolution to embed.
 * @param snapshotId - The current snapshot ID, or null when unavailable.
 * @returns A complete readonly overview.
 */
function createOverview(
  base: BaseResolution,
  snapshotId: string | null,
): RepositoryDiffOverviewValue {
  return {
    repositoryId: snapshotId === null ? null : RepositoryId.fromString("rr1_x"),
    base,
    currentSnapshotId:
      snapshotId === null
        ? null
        : RepositoryCurrentSnapshotId.fromString(snapshotId),
    changed: [],
    changedTree: [],
    allRoot: [],
    all: [],
    ignoredDirectories: [],
    warnings: [],
  };
}

test.each(
  ID_COMPANIONS,
)("%sはfromStringとtoStringで値を往復する", (_name, roundTrip, value) => {
  expect(roundTrip(value)).toBe(value);
});

test.each(
  ID_COMPANIONS,
)("%sのfromStringは冪等である", (_name, roundTrip, value) => {
  expect(roundTrip(roundTrip(value))).toBe(roundTrip(value));
});

test.each([
  [resolvedBase, true],
  [needsSelectionBase, false],
  [invalidOverrideBase, false],
] as const)("BaseResolution.isResolvedはresolvedのみtrueを返す", (base, expected) => {
  expect(BaseResolution.isResolved(base)).toBe(expected);
});

test.each([
  [resolvedBase, false],
  [needsSelectionBase, true],
  [invalidOverrideBase, false],
] as const)("BaseResolution.needsUserSelectionはneedsSelectionのみtrueを返す", (base, expected) => {
  expect(BaseResolution.needsUserSelection(base)).toBe(expected);
});

test.each([
  [true, true],
  [false, false],
])("RepositoryTreeNode.isIgnoredはignored=%sをそのまま返す", (ignored, expected) => {
  expect(RepositoryTreeNode.isIgnored(createTreeNode({ ignored }))).toBe(
    expected,
  );
});

test.each([
  [createTreeNode({ children: { state: "loaded", items: [] } }), false],
  [
    createTreeNode({
      children: {
        state: "deferred",
        nodeId: RepositoryNodeId.fromString("in1_node"),
      },
    }),
    true,
  ],
  [
    createTreeNode({
      kind: "file",
      entryKind: "regular",
      children: { state: "loaded", items: [] },
    }),
    false,
  ],
])("RepositoryTreeNode.hasDeferredChildrenはdeferredのみtrueを返す", (node, expected) => {
  expect(RepositoryTreeNode.hasDeferredChildren(node)).toBe(expected);
});

test("isSnapshotUsableはresolved baseとsnapshotが揃うときtrueを返す", () => {
  expect(
    RepositoryDiffOverview.isSnapshotUsable(
      createOverview(resolvedBase, "rs1_snapshot"),
    ),
  ).toBe(true);
});

test.each([
  ["invalidOverride", invalidOverrideBase],
  ["needsSelection", needsSelectionBase],
] as const)("isSnapshotUsableは%s（snapshot null）でfalseを返す", (_name, base) => {
  expect(
    RepositoryDiffOverview.isSnapshotUsable(createOverview(base, null)),
  ).toBe(false);
});

test("isSnapshotUsableはbaseが未解決ならsnapshotがあってもfalseを返す", () => {
  expect(
    RepositoryDiffOverview.isSnapshotUsable(
      createOverview(needsSelectionBase, "rs1_snapshot"),
    ),
  ).toBe(false);
});
