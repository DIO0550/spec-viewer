import { expect, test } from "vitest";

import {
  BASE_OVERRIDE_REJECTIONS,
  BASE_RESOLUTION_FAILURES,
  BASE_RESOLUTION_SOURCES,
  REPOSITORY_TREE_NODE_KINDS,
} from "@/features/diff/domain/repositoryDiff";
import {
  decodeRepositoryDiffOverview,
  decodeRepositoryFileReview,
} from "@/lib/api/tauri/repositoryDiffDecoder";

import {
  createFileChangeFixture,
  createFileTreeNodeFixture,
  createInvalidOverrideBaseResponse,
  createMinimalFileReviewResponse,
  createMinimalOverviewResponse,
  createNeedsSelectionBaseResponse,
} from "./repositoryDiffTestFixtures";

test.each(
  BASE_RESOLUTION_SOURCES,
)("base.source=%sを保持したままdecodeする", (source) => {
  const response = createMinimalOverviewResponse();
  response.base.source = source;

  const overview = decodeRepositoryDiffOverview(response);

  expect(overview.base).toMatchObject({ state: "resolved", source });
});

test.each(
  BASE_RESOLUTION_FAILURES,
)("base.reason=%sのneedsSelectionをdecodeする", (reason) => {
  const response = createMinimalOverviewResponse();
  response.base = createNeedsSelectionBaseResponse();
  response.base.reason = reason;

  const overview = decodeRepositoryDiffOverview(response);

  expect(overview.base).toMatchObject({ state: "needsSelection", reason });
});

test.each(
  BASE_OVERRIDE_REJECTIONS,
)("base override rejection=%sを保持する", (reason) => {
  const response = createMinimalOverviewResponse();
  response.base = createInvalidOverrideBaseResponse();
  response.base.reason = reason;
  response.repositoryId = null;
  response.currentSnapshotId = null;

  const overview = decodeRepositoryDiffOverview(response);

  expect(overview.base).toMatchObject({ state: "invalidOverride", reason });
  expect(overview.repositoryId).toBeNull();
  expect(overview.currentSnapshotId).toBeNull();
});

test.each([
  ["added", { oldPath: null, newPath: "src/new.ts" }],
  ["modified", { oldPath: "src/a.ts", newPath: "src/a.ts" }],
  ["deleted", { oldPath: "src/old.ts", newPath: null }],
  ["renamed", { oldPath: "src/old.ts", newPath: "src/new.ts" }],
  ["copied", { oldPath: "src/a.ts", newPath: "src/b.ts" }],
  ["typeChanged", { oldPath: "src/a.ts", newPath: "src/a.ts" }],
  ["untracked", { oldPath: null, newPath: "src/new.ts" }],
] as const)("file status=%sをdecodeする", (change, paths) => {
  const response = createMinimalOverviewResponse();
  response.changed = [{ ...createFileChangeFixture(), ...paths, change }];

  expect(decodeRepositoryDiffOverview(response).changed[0]?.change).toBe(
    change,
  );
});

test.each([
  "regular",
  "symlink",
  "submodule",
])("changed entryKind=%sをdecodeする", (entryKind) => {
  const response = createMinimalOverviewResponse();
  response.changed = [{ ...createFileChangeFixture(), entryKind }];

  expect(decodeRepositoryDiffOverview(response).changed[0]?.entryKind).toBe(
    entryKind,
  );
});

test.each([
  "text",
  "binary",
  "notApplicable",
  "unknown",
])("contentClassification=%sをdecodeする", (contentClassification) => {
  const response = createMinimalOverviewResponse();
  response.changed = [{ ...createFileChangeFixture(), contentClassification }];

  expect(
    decodeRepositoryDiffOverview(response).changed[0]?.contentClassification,
  ).toBe(contentClassification);
});

test.each([
  { name: "非null", similarity: 87, oldMode: "100644", newMode: "100755" },
  { name: "null", similarity: null, oldMode: null, newMode: null },
])("similarityとmodeの$nameをdecodeする", ({
  similarity,
  oldMode,
  newMode,
}) => {
  const response = createMinimalOverviewResponse();
  response.changed = [
    { ...createFileChangeFixture(), similarity, oldMode, newMode },
  ];

  expect(decodeRepositoryDiffOverview(response).changed[0]).toMatchObject({
    similarity,
    oldMode,
    newMode,
  });
});

test.each(
  REPOSITORY_TREE_NODE_KINDS,
)("TreeNode.kind=%sをdecodeする", (kind) => {
  const response = createMinimalOverviewResponse();
  response.allRoot = [{ ...createFileTreeNodeFixture(), kind }];

  expect(decodeRepositoryDiffOverview(response).allRoot[0]?.kind).toBe(kind);
});

test.each([
  ["binary", "binary"],
  ["largeFile", "largeFile"],
  ["diffLimit", "diffLimit"],
  ["missingSide", "missingSide"],
  ["unsupportedEntryKind", "unsupportedEntryKind"],
])("structuredDiffのomissionReason=%sをdecodeする", (reason) => {
  const response = createMinimalFileReviewResponse();
  response.structuredDiff = { state: "omitted", hunks: [], reason };

  expect(decodeRepositoryFileReview(response).structuredDiff).toMatchObject({
    state: "omitted",
    reason,
  });
});

test.each([
  "context",
  "added",
  "removed",
  "noNewline",
])("diff lineKind=%sをdecodeする", (kind) => {
  const response = createMinimalFileReviewResponse();
  response.structuredDiff.hunks = [
    { header: "@@ -1 +1 @@", lines: [{ kind, text: "marker" }] },
  ];

  const review = decodeRepositoryFileReview(response);

  expect(review.structuredDiff.hunks[0]?.lines[0]?.kind).toBe(kind);
});
