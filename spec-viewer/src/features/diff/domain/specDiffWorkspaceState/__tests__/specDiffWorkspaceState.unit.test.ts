import { expect, test } from "vitest";

import {
  createInitialSpecDiffWorkspaceState,
  createSpecChangeId,
  projectSpecChangeBadges,
  reduceSpecDiffWorkspaceState,
  type SpecChange,
  type SpecChangeOverview,
} from "@/features/diff/domain/specDiffWorkspaceState";

const createSpecChange = (overrides: Partial<SpecChange> = {}): SpecChange => ({
  specId: "079-issue-168",
  fileKey: "tasks",
  targetPath: ".plugin-workspace/.specs/079-issue-168/tasks.md",
  oldPath: null,
  newPath: ".plugin-workspace/.specs/079-issue-168/tasks.md",
  change: "modified",
  ...overrides,
});

test("Spec変更IDはspecIdとfileKeyを衝突しない形式で結合する", () => {
  expect(
    createSpecChangeId(
      createSpecChange({ specId: "079/issue 168", fileKey: "tech-reference" }),
    ),
  ).toBe("079%2Fissue%20168:tech-reference");
});

test.each([
  "modified",
  "deleted",
  "renamed",
  "copied",
  "typeChanged",
] as const)("Spec変更badgeは%sをMへ写像する", (change) => {
  const badges = projectSpecChangeBadges([createSpecChange({ change })]);

  expect(badges.get("079-issue-168")).toBe("M");
});

test.each([
  "added",
  "untracked",
] as const)("Spec変更badgeは%sをUへ写像する", (change) => {
  const badges = projectSpecChangeBadges([createSpecChange({ change })]);

  expect(badges.get("079-issue-168")).toBe("U");
});

test("Spec変更badgeは同一SpecのMとUが混在するとUを1つだけ保持する", () => {
  const badges = projectSpecChangeBadges([
    createSpecChange({ change: "untracked", fileKey: "tasks" }),
    createSpecChange({ change: "modified", fileKey: "impl" }),
  ]);

  expect([...badges.entries()]).toEqual([["079-issue-168", "U"]]);
});

test("Spec diff stateはworkspaceなしでidleから始まる", () => {
  expect(createInitialSpecDiffWorkspaceState()).toEqual({
    status: "idle",
    workspacePath: null,
    cycleId: 0,
    requestGeneration: 0,
  });
});

test("Spec diff stateはoverview取得開始でloadingへ遷移する", () => {
  const state = reduceSpecDiffWorkspaceState(
    createInitialSpecDiffWorkspaceState(),
    {
      type: "overviewStarted",
      workspacePath: "/workspace",
      cycleId: 1,
      requestGeneration: 1,
    },
  );

  expect(state).toEqual({
    status: "loading",
    workspacePath: "/workspace",
    cycleId: 1,
    requestGeneration: 1,
  });
});

test("Spec diff stateはoverview成功でreadyへ遷移する", () => {
  const overview: SpecChangeOverview = {
    currentSnapshotId: "rs1_snapshot",
    resolvedBaseSha: "a".repeat(40),
    diffReviewIdentity: null,
    files: [],
  };
  const loading = reduceSpecDiffWorkspaceState(
    createInitialSpecDiffWorkspaceState(),
    {
      type: "overviewStarted",
      workspacePath: "/workspace",
      cycleId: 1,
      requestGeneration: 1,
    },
  );

  const ready = reduceSpecDiffWorkspaceState(loading, {
    type: "overviewSucceeded",
    workspacePath: "/workspace",
    cycleId: 1,
    requestGeneration: 1,
    overview,
    selection: { specId: "079-issue-168", fileKey: "tasks" },
  });

  expect(ready).toEqual({
    status: "ready",
    workspacePath: "/workspace",
    cycleId: 1,
    requestGeneration: 1,
    overview,
    detail: { status: "unchanged" },
  });
});

test.each([
  "notRepository",
  "bareRepository",
  "worktreeUnavailable",
  "gitUnavailable",
  "unbornHead",
] as const)("Spec diff stateはrepository不可code=%sをunavailableへ遷移する", (code) => {
  const loading = reduceSpecDiffWorkspaceState(
    createInitialSpecDiffWorkspaceState(),
    {
      type: "overviewStarted",
      workspacePath: "/workspace",
      cycleId: 2,
      requestGeneration: 3,
    },
  );

  const state = reduceSpecDiffWorkspaceState(loading, {
    type: "overviewFailed",
    workspacePath: "/workspace",
    cycleId: 2,
    requestGeneration: 3,
    code,
    message: ` failure`,
  });

  expect(state).toEqual({
    status: "unavailable",
    workspacePath: "/workspace",
    cycleId: 2,
    requestGeneration: 3,
    reason: ` failure`,
  });
});

test("Spec diff stateは一般overview errorをretry可能なfailedへ遷移する", () => {
  const loading = reduceSpecDiffWorkspaceState(
    createInitialSpecDiffWorkspaceState(),
    {
      type: "overviewStarted",
      workspacePath: "/workspace",
      cycleId: 2,
      requestGeneration: 3,
    },
  );

  const state = reduceSpecDiffWorkspaceState(loading, {
    type: "overviewFailed",
    workspacePath: "/workspace",
    cycleId: 2,
    requestGeneration: 3,
    code: "gitTimedOut",
    message: "Git operation timed out",
  });

  expect(state).toEqual({
    status: "failed",
    workspacePath: "/workspace",
    cycleId: 2,
    requestGeneration: 3,
    message: "Git operation timed out",
  });
});

test("Spec diff stateは選択中logical fileが変更一覧にあればdetail loadingへ遷移する", () => {
  const loading = reduceSpecDiffWorkspaceState(
    createInitialSpecDiffWorkspaceState(),
    {
      type: "overviewStarted",
      workspacePath: "/workspace",
      cycleId: 4,
      requestGeneration: 5,
    },
  );
  const change = createSpecChange();

  const state = reduceSpecDiffWorkspaceState(loading, {
    type: "overviewSucceeded",
    workspacePath: "/workspace",
    cycleId: 4,
    requestGeneration: 5,
    overview: {
      currentSnapshotId: "rs1_snapshot",
      resolvedBaseSha: "a".repeat(40),
      diffReviewIdentity: null,
      files: [change],
    },
    selection: { specId: change.specId, fileKey: "tasks" },
  });

  expect(state.status).toBe("ready");
  expect(state.status === "ready" ? state.detail : null).toEqual({
    status: "loading",
    fileId: "079-issue-168:tasks",
  });
});

test("Spec diff stateは古いrequest generationのoverview結果を無視する", () => {
  const loading = reduceSpecDiffWorkspaceState(
    createInitialSpecDiffWorkspaceState(),
    {
      type: "overviewStarted",
      workspacePath: "/workspace",
      cycleId: 4,
      requestGeneration: 6,
    },
  );

  const state = reduceSpecDiffWorkspaceState(loading, {
    type: "overviewSucceeded",
    workspacePath: "/workspace",
    cycleId: 4,
    requestGeneration: 5,
    overview: {
      currentSnapshotId: "stale",
      resolvedBaseSha: "a".repeat(40),
      diffReviewIdentity: null,
      files: [],
    },
    selection: { specId: "079-issue-168", fileKey: "tasks" },
  });

  expect(state).toBe(loading);
});
