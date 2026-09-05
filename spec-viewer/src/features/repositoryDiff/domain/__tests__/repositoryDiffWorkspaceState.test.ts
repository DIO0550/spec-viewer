import { expect, test } from "vitest";

import {
  RepositoryDiffSelection,
  type RepositoryDiffOverview,
  type RepositoryFileReview,
} from "@/features/repositoryDiff/domain/repositoryDiff";
import {
  createInitialRepositoryDiffWorkspaceState,
  repositoryDiffWorkspaceReducer,
  type RepositoryDiffRequestIdentity,
  type RepositoryDiffWorkspaceState,
} from "@/features/repositoryDiff/domain/repositoryDiffWorkspaceState";

const request: RepositoryDiffRequestIdentity = {
  workspacePath: "/workspace",
  worktreeId: "/workspace",
  baseOverride: null,
  cycleId: 1,
  requestGeneration: 1,
};

const snapshotId = `rs1_${"b".repeat(64)}`;
const overview = (
  base: RepositoryDiffOverview["base"],
  currentSnapshotId: string | null = null,
): RepositoryDiffOverview => ({
  repositoryId: `rr1_${"a".repeat(64)}`,
  base,
  currentSnapshotId,
  changed: [],
  changedTree: [],
  allRoot: [],
  allPaths: [],
  ignoredDirectories: [],
  warnings: [],
});

test("初期 state は idle と unchanged detail になる", () => {
  expect(createInitialRepositoryDiffWorkspaceState()).toEqual({
    status: "idle",
    request: null,
    overview: null,
    detail: { status: "unchanged" },
    ignoredPages: {},
    ignoredPageStates: {},
    error: null,
  });
});

test("overview request の後に resolved overview は ready になる", () => {
  const loading = repositoryDiffWorkspaceReducer(
    createInitialRepositoryDiffWorkspaceState(),
    { type: "overviewRequested", request },
  );
  const ready = repositoryDiffWorkspaceReducer(loading, {
    type: "overviewSucceeded",
    request,
    overview: overview({
      state: "resolved",
      source: "main",
      branchRef: "refs/heads/main",
      mergeBaseSha: "c".repeat(40),
      headSha: "d".repeat(40),
    }),
  });

  expect(ready.status).toBe("ready");
  expect(ready.request).toEqual(request);
});

test.each([
  {
    state: "needsSelection",
    reason: "unbornHead",
    candidates: ["refs/heads/main"],
  },
  {
    state: "invalidOverride",
    reason: "missingRef",
    overrideRef: "refs/heads/missing",
  },
] as const)("base state=%sは snapshotなしの選択状態になる", (base) => {
  const loading = repositoryDiffWorkspaceReducer(
    createInitialRepositoryDiffWorkspaceState(),
    { type: "overviewRequested", request },
  );
  const state = repositoryDiffWorkspaceReducer(loading, {
    type: "overviewSucceeded",
    request,
    overview: overview(base),
  });

  expect(state.overview?.currentSnapshotId).toBe(null);
});

test("request identity が古い overview success は state を変更しない", () => {
  const loading = repositoryDiffWorkspaceReducer(
    createInitialRepositoryDiffWorkspaceState(),
    { type: "overviewRequested", request },
  );
  const staleRequest = { ...request, requestGeneration: 2 };
  const state = repositoryDiffWorkspaceReducer(loading, {
    type: "overviewSucceeded",
    request: staleRequest,
    overview: overview({
      state: "resolved",
      source: "main",
      branchRef: "refs/heads/main",
      mergeBaseSha: "c".repeat(40),
      headSha: "d".repeat(40),
    }),
  });

  expect(state).toBe(loading);
});

test("repository selection key は worktree・snapshot・path を衝突なく含む", () => {
  expect(
    RepositoryDiffSelection.key({
      worktreeId: "/workspace",
      snapshotId: `rs1_${"b".repeat(64)}`,
      path: "src/file.ts",
    }),
  ).toBe(
    "%2Fworkspace:rs1_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb:src%2Ffile.ts",
  );
});

const review: RepositoryFileReview = {
  file: {
    oldPath: "src/file.ts",
    newPath: "src/file.ts",
    change: "modified",
    entryKind: "regular",
    contentClassification: "text",
    similarity: null,
    oldMode: null,
    newMode: null,
  },
  oldContent: {
    state: "available",
    text: "old",
    reason: null,
    byteLength: null,
  },
  newContent: {
    state: "available",
    text: "new",
    reason: null,
    byteLength: null,
  },
  patch: { state: "available", text: "patch", reason: null, byteLength: null },
  structuredDiff: { state: "available", hunks: [], reason: null },
  submodule: null,
};

const createReadyState = (): RepositoryDiffWorkspaceState => {
  const loading = repositoryDiffWorkspaceReducer(
    createInitialRepositoryDiffWorkspaceState(),
    { type: "overviewRequested", request },
  );

  return repositoryDiffWorkspaceReducer(loading, {
    type: "overviewSucceeded",
    request,
    overview: overview(
      {
        state: "resolved",
        source: "main",
        branchRef: "refs/heads/main",
        mergeBaseSha: "c".repeat(40),
        headSha: "d".repeat(40),
      },
      snapshotId,
    ),
  });
};

test("detail request は ready overview の snapshot identity で loading になる", () => {
  const identity = {
    request,
    snapshotId,
    path: "src/file.ts",
    detailGeneration: 1,
  };
  const loading = repositoryDiffWorkspaceReducer(createReadyState(), {
    type: "detailRequested",
    identity,
  });

  expect(loading.detail).toEqual({ status: "loading", identity });
});

test("detail success は同一 identity の review を ready にする", () => {
  const identity = {
    request,
    snapshotId,
    path: "src/file.ts",
    detailGeneration: 1,
  };
  const loading = repositoryDiffWorkspaceReducer(createReadyState(), {
    type: "detailRequested",
    identity,
  });
  const ready = repositoryDiffWorkspaceReducer(loading, {
    type: "detailSucceeded",
    identity,
    review,
  });

  expect(ready.detail).toEqual({ status: "ready", identity, review });
});

test("古い detail success は現在の loading state を変更しない", () => {
  const identity = {
    request,
    snapshotId,
    path: "src/file.ts",
    detailGeneration: 1,
  };
  const loading = repositoryDiffWorkspaceReducer(createReadyState(), {
    type: "detailRequested",
    identity,
  });
  const staleIdentity = { ...identity, detailGeneration: 2 };
  const state = repositoryDiffWorkspaceReducer(loading, {
    type: "detailSucceeded",
    identity: staleIdentity,
    review,
  });

  expect(state).toBe(loading);
});

test("ignored page は loading から ready へ遷移し page を保持する", () => {
  const page = {
    nodeId: "in1_" + "e".repeat(64),
    entries: [],
    nextCursor: "cursor-2",
  };
  const identity = {
    request,
    snapshotId,
    nodeId: page.nodeId,
    cursor: null,
    pageGeneration: 1,
  };
  const loading = repositoryDiffWorkspaceReducer(createReadyState(), {
    type: "ignoredPageRequested",
    identity,
  });
  const state = repositoryDiffWorkspaceReducer(loading, {
    type: "ignoredPageSucceeded",
    identity,
    page,
  });

  expect(loading.ignoredPageStates[page.nodeId]).toEqual({
    status: "loading",
    identity,
  });
  expect(state.ignoredPages[page.nodeId]).toEqual(page);
  expect(state.ignoredPageStates[page.nodeId]).toEqual({
    status: "ready",
    identity,
    page,
  });
});

test("ignored page の次 cursor は先行 page に append する", () => {
  const nodeId = "in1_" + "e".repeat(64);
  const firstPage = { nodeId, entries: [], nextCursor: "cursor-2" };
  const firstIdentity = {
    request,
    snapshotId,
    nodeId,
    cursor: null,
    pageGeneration: 1,
  };
  const firstLoading = repositoryDiffWorkspaceReducer(createReadyState(), {
    type: "ignoredPageRequested",
    identity: firstIdentity,
  });
  const firstReady = repositoryDiffWorkspaceReducer(firstLoading, {
    type: "ignoredPageSucceeded",
    identity: firstIdentity,
    page: firstPage,
  });
  const secondIdentity = {
    ...firstIdentity,
    cursor: firstPage.nextCursor,
    pageGeneration: 2,
  };
  const secondLoading = repositoryDiffWorkspaceReducer(firstReady, {
    type: "ignoredPageRequested",
    identity: secondIdentity,
  });
  const state = repositoryDiffWorkspaceReducer(secondLoading, {
    type: "ignoredPageSucceeded",
    identity: secondIdentity,
    page: { nodeId, entries: [], nextCursor: null },
  });

  expect(state.ignoredPages[nodeId]?.nextCursor).toBe(null);
  expect(state.ignoredPages[nodeId]?.entries).toEqual([]);
});

test("古い cursor の ignored page success は現在の loading state を変更しない", () => {
  const nodeId = "in1_" + "e".repeat(64);
  const currentIdentity = {
    request,
    snapshotId,
    nodeId,
    cursor: "cursor-2",
    pageGeneration: 2,
  };
  const staleIdentity = { ...currentIdentity, cursor: null, pageGeneration: 1 };
  const loading = repositoryDiffWorkspaceReducer(createReadyState(), {
    type: "ignoredPageRequested",
    identity: currentIdentity,
  });
  const state = repositoryDiffWorkspaceReducer(loading, {
    type: "ignoredPageSucceeded",
    identity: staleIdentity,
    page: { nodeId, entries: [], nextCursor: null },
  });

  expect(state.ignoredPageStates[nodeId]).toEqual({
    status: "loading",
    identity: currentIdentity,
  });
});

test("ignored page failure は page state に retryable error を保持する", () => {
  const nodeId = "in1_" + "e".repeat(64);
  const identity = {
    request,
    snapshotId,
    nodeId,
    cursor: null,
    pageGeneration: 1,
  };
  const loading = repositoryDiffWorkspaceReducer(createReadyState(), {
    type: "ignoredPageRequested",
    identity,
  });
  const state = repositoryDiffWorkspaceReducer(loading, {
    type: "ignoredPageFailed",
    identity,
    error: { code: "staleCursor", message: "stale", retryable: true },
  });

  expect(state.status).toBe("ready");
  expect(state.ignoredPageStates[nodeId]).toEqual({
    status: "failed",
    identity,
    error: { code: "staleCursor", message: "stale", retryable: true },
  });
});

test("古い request の ignored page success は merge しない", () => {
  const nodeId = "in1_" + "e".repeat(64);
  const staleRequest = { ...request, requestGeneration: 2 };
  const identity = {
    request: staleRequest,
    snapshotId,
    nodeId,
    cursor: null,
    pageGeneration: 1,
  };
  const ready = createReadyState();
  const state = repositoryDiffWorkspaceReducer(ready, {
    type: "ignoredPageSucceeded",
    identity,
    page: { nodeId, entries: [], nextCursor: null },
  });

  expect(state).toBe(ready);
});
