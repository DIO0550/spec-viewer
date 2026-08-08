import { expect, test } from "vitest";

import {
  RepositoryNodeId,
  RepositoryTreeNode,
} from "@/features/diff/domain/repositoryDiff";
import {
  decodeRepositoryDiffOverview,
  decodeRepositoryFileReview,
  decodeRepositoryIgnoredPage,
} from "@/lib/api/tauri/repositoryDiffDecoder";

import {
  createDeferredTreeNodeFixture,
  createFileTreeNodeFixture,
  createLoadedTreeNodeFixture,
  createMinimalFileReviewResponse,
  createMinimalIgnoredPageResponse,
  createMinimalOverviewResponse,
  SAMPLE_NODE_ID,
  SAMPLE_REPOSITORY_ID,
  SAMPLE_SNAPSHOT_ID,
  type TreeNodeFixture,
} from "./repositoryDiffTestFixtures";

/**
 * Nests a chain of loaded directory nodes to the requested depth.
 *
 * @param depth - How many directory levels to build.
 * @returns The root of the generated chain.
 */
function createNestedTree(depth: number): TreeNodeFixture {
  const leaf = createFileTreeNodeFixture();
  let node: TreeNodeFixture = leaf;
  for (let level = depth; level > 0; level -= 1) {
    node = {
      ...createLoadedTreeNodeFixture(),
      path: `level-${level}`,
      name: `level-${level}`,
      children: { state: "loaded", items: [node] },
    };
  }
  return node;
}

test("最小のoverview応答をdecodeする", () => {
  const overview = decodeRepositoryDiffOverview(
    createMinimalOverviewResponse(),
  );

  expect(overview.repositoryId).toBe(SAMPLE_REPOSITORY_ID);
  expect(overview.currentSnapshotId).toBe(SAMPLE_SNAPSHOT_ID);
  expect(overview.base).toMatchObject({
    state: "resolved",
    branchRef: "refs/remotes/origin/main",
  });
});

test("children.state=loadedの子ノードを再帰的にdecodeする", () => {
  const response = createMinimalOverviewResponse();
  response.allRoot = [
    {
      ...createLoadedTreeNodeFixture(),
      children: { state: "loaded", items: [createFileTreeNodeFixture()] },
    },
  ];

  const children = decodeRepositoryDiffOverview(response).allRoot[0]?.children;

  expect(children?.state).toBe("loaded");
  expect(children?.state === "loaded" && children.items[0]?.name).toBe(
    "main.ts",
  );
});

test("children.state=deferredはnodeIdを保持する", () => {
  const response = createMinimalOverviewResponse();
  response.allRoot = [createDeferredTreeNodeFixture()];

  const node = decodeRepositoryDiffOverview(response).allRoot[0];

  expect(
    node !== undefined && RepositoryTreeNode.hasDeferredChildren(node),
  ).toBe(true);
  expect(node?.children.state === "deferred" && node.children.nodeId).toBe(
    SAMPLE_NODE_ID,
  );
});

test("5階層の深いツリーを再帰decodeする", () => {
  const response = createMinimalOverviewResponse();
  response.allRoot = [createNestedTree(5)];

  const decoded = decodeRepositoryDiffOverview(response);

  expect(decoded.allRoot).toEqual([createNestedTree(5)]);
  expect(decoded.allRoot[0]?.name).toBe("level-1");
});

test.each([
  [true, true],
  [false, false],
])("TreeNode.ignored=%sはchangeと直交して保持される", (ignored, expected) => {
  const response = createMinimalOverviewResponse();
  response.allRoot = [{ ...createFileTreeNodeFixture(), ignored }];

  const node = decodeRepositoryDiffOverview(response).allRoot[0];

  expect(node?.ignored).toBe(expected);
  expect(node?.change).toBe("untracked");
});

test("all[]の配列参照をコピーせずそのまま返す", () => {
  const response = createMinimalOverviewResponse();
  response.all = ["src/a.ts", "src/b.ts"];

  expect(decodeRepositoryDiffOverview(response).all).toBe(response.all);
});

test("1000要素のall[]でも同一参照を返す", () => {
  const response = createMinimalOverviewResponse();
  response.all = Array.from({ length: 1000 }, (_, i) => `src/${i}.ts`);

  expect(decodeRepositoryDiffOverview(response).all).toBe(response.all);
});

test("ignoredDirectoriesとwarningsを素通しする", () => {
  const response = createMinimalOverviewResponse();
  response.ignoredDirectories = ["node_modules", "dist"];
  response.warnings = ["partial scan"];

  const overview = decodeRepositoryDiffOverview(response);

  expect(overview.ignoredDirectories).toBe(response.ignoredDirectories);
  expect(overview.warnings).toBe(response.warnings);
});

test.each([
  { name: "prefixなしのrepositoryId", repositoryId: "plain-repository" },
  { name: "64hexでないsnapshotId", currentSnapshotId: "snapshot-1" },
])("不透明ID（$name）は形式を検証せず素通しする", (overrides) => {
  const response = { ...createMinimalOverviewResponse(), ...overrides };

  expect(() => decodeRepositoryDiffOverview(response)).not.toThrow();
});

test("ic1形式でないcursorも素通しする", () => {
  const response = createMinimalIgnoredPageResponse();
  response.nextCursor = "opaque-cursor";

  expect(decodeRepositoryIgnoredPage(response).nextCursor).toBe(
    "opaque-cursor",
  );
});

test("nextCursor非nullのignored pageをdecodeする", () => {
  const response = createMinimalIgnoredPageResponse();
  response.entries = [createFileTreeNodeFixture()];
  response.nextCursor = "ic1_offset_200";

  const page = decodeRepositoryIgnoredPage(response);

  expect(page.nodeId).toBe(RepositoryNodeId.fromString(SAMPLE_NODE_ID));
  expect(page.entries).toHaveLength(1);
  expect(page.nextCursor).toBe("ic1_offset_200");
});

test("nextCursor=nullは終端として扱う", () => {
  expect(
    decodeRepositoryIgnoredPage(createMinimalIgnoredPageResponse()).nextCursor,
  ).toBeNull();
});

test("空の配列群をそのままdecodeする", () => {
  const overview = decodeRepositoryDiffOverview(
    createMinimalOverviewResponse(),
  );

  expect(overview.changed).toEqual([]);
  expect(overview.changedTree).toEqual([]);
  expect(overview.allRoot).toEqual([]);
  expect(overview.all).toEqual([]);
});

test("submodule stateの3 OIDと4 booleanをdecodeする", () => {
  const response = createMinimalFileReviewResponse();
  response.submodule = {
    baseGitlinkOid: "1".repeat(40),
    indexGitlinkOid: null,
    worktreeHeadOid: "3".repeat(40),
    commitChanged: true,
    trackedChanges: false,
    untrackedChanges: true,
    uninitialized: false,
  };

  expect(decodeRepositoryFileReview(response).submodule).toEqual(
    response.submodule,
  );
});
