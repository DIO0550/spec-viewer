import { expect, test } from "vitest";

import {
  DiffCommentSessionState,
  diffCommentIdentityKey,
  type DiffReviewIdentity,
} from "@/features/diffComments";

const identityA: DiffReviewIdentity = {
  repositoryId: `rr1_${"a".repeat(64)}`,
  worktreeId: `rw1_${"b".repeat(64)}`,
  baseSha: "c".repeat(40),
  currentSnapshotId: `rs1_${"d".repeat(64)}`,
};

const identityB: DiffReviewIdentity = {
  ...identityA,
  currentSnapshotId: `rs1_${"e".repeat(64)}`,
};

test("identity keyは4値すべてを区別する", () => {
  expect(diffCommentIdentityKey(identityA)).not.toBe(
    diffCommentIdentityKey(identityB),
  );
});

test("identity refreshで未送信draftをstaleTargetにしてsubmitを禁止する", () => {
  const initial = DiffCommentSessionState.create(identityA);
  const drafting = DiffCommentSessionState.reduce(initial, {
    type: "draftCreated",
    target: { side: "current", newPath: "src/main.ts", line: 3 },
  });
  const edited = DiffCommentSessionState.reduce(drafting, {
    type: "draftBodyChanged",
    body: "retain me",
  });

  const refreshed = DiffCommentSessionState.switchIdentity(edited, identityB);

  expect(refreshed.draft).toMatchObject({
    state: "staleTarget",
    body: "retain me",
    canSubmit: false,
  });
});

test("committed結果はorigin sessionへsettleしてdraftを閉じる", () => {
  const initial = DiffCommentSessionState.reduce(
    DiffCommentSessionState.create(identityA),
    {
      type: "draftCreated",
      target: { side: "current", newPath: "src/main.ts", line: 3 },
    },
  );
  const document = {
    version: 1 as const,
    repositoryId: identityA.repositoryId,
    worktreeId: identityA.worktreeId,
    revision: "1",
    comments: [],
    resolutionWarnings: [],
  };

  const settled = DiffCommentSessionState.reduce(initial, {
    type: "mutationSettled",
    outcome: {
      kind: "committed",
      document,
      revision: "1",
      resolutionWarnings: [],
      durability: "uncertain",
    },
  });

  expect(settled.revision).toBe("1");
  expect(settled.draft).toBeNull();
  expect(settled.mutation).toMatchObject({
    state: "committed",
    durability: "uncertain",
  });
});

test("conflictはlatestを採用してdraftを明示retry可能なまま保持する", () => {
  const initial = DiffCommentSessionState.reduce(
    DiffCommentSessionState.create(identityA),
    {
      type: "draftCreated",
      target: { side: "current", newPath: "src/main.ts", line: 3 },
    },
  );
  const latestDocument = {
    version: 1 as const,
    ...identityA,
    revision: "2",
    comments: [],
    resolutionWarnings: [],
  };

  const settled = DiffCommentSessionState.reduce(initial, {
    type: "mutationSettled",
    outcome: {
      kind: "conflict",
      latestDocument,
      latestRevision: "2",
      resolutionWarnings: [],
    },
  });

  expect(settled.revision).toBe("2");
  expect(settled.draft).toMatchObject({ canSubmit: true });
  expect(settled.mutation).toEqual({ state: "conflict" });
});

test("conflictのlatest revisionがu64上限ならidentity全体とdraftを書き込み禁止にする", () => {
  const initial = DiffCommentSessionState.reduce(
    DiffCommentSessionState.create(identityA),
    {
      type: "draftCreated",
      target: { side: "current", newPath: "src/main.ts", line: 3 },
      body: "must remain copyable",
    },
  );
  const latestDocument = {
    version: 1 as const,
    ...identityA,
    revision: "18446744073709551615",
    comments: [],
    resolutionWarnings: [],
  };

  const settled = DiffCommentSessionState.reduce(initial, {
    type: "mutationSettled",
    outcome: {
      kind: "conflict",
      latestDocument,
      latestRevision: latestDocument.revision,
      resolutionWarnings: [],
    },
  });

  expect(settled.writeBlockReason).toBe("revisionOverflow");
  expect(settled.draft).toMatchObject({
    body: "must remain copyable",
    canSubmit: false,
    disabledReason: "revisionOverflow",
  });
});

test("revision overflowはcurrent dataを採用してdraftのsubmitを禁止する", () => {
  const initial = DiffCommentSessionState.reduce(
    DiffCommentSessionState.create(identityA),
    {
      type: "draftCreated",
      target: { side: "current", newPath: "src/main.ts", line: 3 },
      body: "copyable body",
    },
  );
  const currentDocument = {
    version: 1 as const,
    repositoryId: identityA.repositoryId,
    worktreeId: identityA.worktreeId,
    revision: "18446744073709551615",
    comments: [],
    resolutionWarnings: [],
  };

  const settled = DiffCommentSessionState.reduce(initial, {
    type: "mutationSettled",
    outcome: {
      kind: "preCommitFailure",
      code: "revisionOverflow",
      currentDocument,
      currentRevision: "18446744073709551615",
      retryable: false,
    },
  });

  expect(settled.revision).toBe("18446744073709551615");
  expect(settled.draft).toMatchObject({
    body: "copyable body",
    canSubmit: false,
  });
  expect(settled.mutation).toMatchObject({
    code: "revisionOverflow",
    retryable: false,
  });
});

test("saving中はdraftを無効化しtransport failure後にretry可能へ戻す", () => {
  const drafting = DiffCommentSessionState.reduce(
    DiffCommentSessionState.create(identityA),
    {
      type: "draftCreated",
      target: { side: "current", newPath: "src/main.ts", line: 3 },
      body: "retry me",
    },
  );

  const saving = DiffCommentSessionState.reduce(drafting, {
    type: "mutationStarted",
  });
  expect(saving.draft).toMatchObject({
    canSubmit: false,
    disabledReason: "saving",
  });

  const failed = DiffCommentSessionState.reduce(saving, {
    type: "mutationTransportFailed",
  });
  expect(failed.draft).toMatchObject({
    canSubmit: true,
    disabledReason: null,
  });
});

test.each([
  "permission",
  "invalidStore",
] as const)("%s failureはdraftに非retry理由を公開する", (code) => {
  const drafting = DiffCommentSessionState.reduce(
    DiffCommentSessionState.create(identityA),
    {
      type: "draftCreated",
      target: { side: "current", newPath: "src/main.ts", line: 3 },
    },
  );
  const settled = DiffCommentSessionState.reduce(drafting, {
    type: "mutationSettled",
    outcome: { kind: "preCommitFailure", code, retryable: false },
  });

  expect(settled.draft).toMatchObject({
    canSubmit: false,
    disabledReason: code,
  });
  expect(settled.writeBlockReason).toBe(code);

  const discarded = DiffCommentSessionState.reduce(settled, {
    type: "draftDiscarded",
  });
  const recreated = DiffCommentSessionState.reduce(discarded, {
    type: "draftCreated",
    target: { side: "current", newPath: "src/other.ts", line: 9 },
  });
  const reanchored = DiffCommentSessionState.reduce(recreated, {
    type: "draftReanchored",
    target: { side: "current", newPath: "src/next.ts", line: 10 },
  });

  expect(reanchored.draft).toMatchObject({
    canSubmit: false,
    disabledReason: code,
  });
});

test("成功したreloadだけがpermission write blockを解除する", () => {
  const drafting = DiffCommentSessionState.reduce(
    DiffCommentSessionState.create(identityA),
    {
      type: "draftCreated",
      target: { side: "current", newPath: "src/main.ts", line: 3 },
    },
  );
  const blocked = DiffCommentSessionState.reduce(drafting, {
    type: "mutationSettled",
    outcome: {
      kind: "preCommitFailure",
      code: "permission",
      retryable: false,
    },
  });

  const loading = DiffCommentSessionState.reduce(blocked, { type: "loading" });
  const failed = DiffCommentSessionState.reduce(loading, {
    type: "loadFailed",
  });
  expect(failed.writeBlockReason).toBe("permission");

  const recovered = DiffCommentSessionState.reduce(failed, {
    type: "loaded",
    revision: "3",
    comments: [],
    resolutionWarnings: [],
  });
  expect(recovered.draft).toMatchObject({
    canSubmit: true,
    disabledReason: null,
  });
  expect(recovered.writeBlockReason).toBeNull();
});

test("revision上限のdocumentは成功reload後もidentity全体を書き込み禁止にする", () => {
  const loaded = DiffCommentSessionState.reduce(
    DiffCommentSessionState.create(identityA),
    {
      type: "loaded",
      revision: "18446744073709551615",
      comments: [],
      resolutionWarnings: [],
    },
  );
  const drafted = DiffCommentSessionState.reduce(loaded, {
    type: "draftCreated",
    target: { side: "current", newPath: "src/main.ts", line: 3 },
  });

  expect(loaded.writeBlockReason).toBe("revisionOverflow");
  expect(drafted.draft).toMatchObject({
    canSubmit: false,
    disabledReason: "revisionOverflow",
  });
});

test.each([
  "storeBusy",
  "io",
] as const)("%s failureはdraftをretry可能に戻す", (code) => {
  const drafting = DiffCommentSessionState.reduce(
    DiffCommentSessionState.create(identityA),
    {
      type: "draftCreated",
      target: { side: "current", newPath: "src/main.ts", line: 3 },
    },
  );
  const settled = DiffCommentSessionState.reduce(drafting, {
    type: "mutationSettled",
    outcome: { kind: "preCommitFailure", code, retryable: true },
  });

  expect(settled.draft).toMatchObject({
    canSubmit: true,
    disabledReason: null,
  });
});
