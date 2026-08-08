import { vi } from "vitest";

import {
  RepositoryCurrentSnapshotId,
  type RepositoryDiffOverview,
  type RepositoryFileReview,
  RepositoryId,
  type RepositoryIgnoredPage,
  RepositoryNodeId,
  RepositoryWorktreeId,
} from "@/features/diff/domain/repositoryDiff";
import type {
  UseRepositoryDiffWorkspaceOptions,
  UseRepositoryDiffWorkspaceResult,
} from "@/features/diff/hooks/useRepositoryDiffWorkspace";
import { useRepositoryDiffWorkspace } from "@/features/diff/hooks/useRepositoryDiffWorkspace";
import type { RepositoryCommands } from "@/lib/api/tauri";
import type { RenderHookResult } from "@/lib/test/renderHook";
import { renderHook } from "@/lib/test/renderHook";

export const WORKTREE_A = RepositoryWorktreeId.fromString("/repo/a");
export const WORKTREE_B = RepositoryWorktreeId.fromString("/repo/b");
export const SNAPSHOT_A = RepositoryCurrentSnapshotId.fromString("rs1_a");
export const NODE_A = RepositoryNodeId.fromString("in1_a");

/**
 * Builds an overview scoped to the given snapshot.
 *
 * @param snapshotId - Snapshot the overview belongs to, or null when unusable.
 * @returns A minimal readonly overview with a resolved base.
 */
export function createOverview(
  snapshotId: RepositoryDiffOverview["currentSnapshotId"] = SNAPSHOT_A,
): RepositoryDiffOverview {
  return {
    repositoryId: RepositoryId.fromString("rr1_a"),
    base: {
      state: "resolved",
      source: "originHead",
      branchRef: "refs/remotes/origin/main",
      mergeBaseSha: "a".repeat(40),
      headSha: "b".repeat(40),
    },
    currentSnapshotId: snapshotId,
    changed: [],
    changedTree: [],
    allRoot: [],
    all: [],
    ignoredDirectories: [],
    warnings: [],
  };
}

/**
 * Builds an overview whose base override was rejected, so no snapshot exists.
 *
 * @returns A readonly overview with an `invalidOverride` base.
 */
export function createInvalidOverrideOverview(): RepositoryDiffOverview {
  return {
    ...createOverview(null),
    repositoryId: null,
    base: {
      state: "invalidOverride",
      reason: "invalidRef",
      overrideRef: "refs/heads/missing",
    },
  };
}

export const emptyPage: RepositoryIgnoredPage = {
  nodeId: NODE_A,
  entries: [],
  nextCursor: null,
};

export const review: RepositoryFileReview = {
  file: {
    oldPath: "src/main.ts",
    newPath: "src/main.ts",
    change: "modified",
    entryKind: "regular",
    contentClassification: "text",
    similarity: null,
    oldMode: "100644",
    newMode: "100644",
  },
  oldContent: { state: "available", text: "a", reason: null, byteLength: null },
  newContent: { state: "available", text: "b", reason: null, byteLength: null },
  patch: { state: "available", text: "", reason: null, byteLength: null },
  structuredDiff: { state: "available", hunks: [], reason: null },
  submodule: null,
};

/**
 * Builds a stubbed command set whose defaults all succeed.
 *
 * @param overrides - Commands to replace on the default stub.
 * @returns The stubbed command set.
 */
export function createCommands(
  overrides: Partial<RepositoryCommands> = {},
): RepositoryCommands {
  return {
    loadOverview: vi.fn(async () => createOverview()),
    traverseIgnored: vi.fn(async () => emptyPage),
    loadFile: vi.fn(async () => review),
    ...overrides,
  };
}

/**
 * Renders the repository diff workspace hook with the shared harness.
 *
 * @param options - Hook options for the first render.
 * @returns The rendered hook handle.
 */
export function renderWorkspace(
  options: UseRepositoryDiffWorkspaceOptions,
): RenderHookResult<
  UseRepositoryDiffWorkspaceOptions,
  UseRepositoryDiffWorkspaceResult
> {
  return renderHook(useRepositoryDiffWorkspace, options);
}
