import { invoke } from "@tauri-apps/api/core";
import { expect, test, vi } from "vitest";

import {
  loadDiffComments,
  saveDiffComment,
  updateDiffComment,
} from "@/lib/api/tauri/diffComments";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

const invokeMock = vi.mocked(invoke);
const identity = {
  repositoryId: `rr1_${"a".repeat(64)}`,
  worktreeId: `rw1_${"b".repeat(64)}`,
  baseSha: "c".repeat(40),
  currentSnapshotId: `rs1_${"d".repeat(64)}`,
} as const;
const document = {
  version: 1,
  repositoryId: identity.repositoryId,
  worktreeId: identity.worktreeId,
  revision: "0",
  comments: [],
  resolutionWarnings: [],
} as const;

test("loadDiffCommentsはidentityをrequest wrapperで送りresponseをdecodeする", async () => {
  invokeMock.mockReset();
  invokeMock.mockResolvedValue(document);

  await expect(loadDiffComments({ identity })).resolves.toEqual(document);
  expect(invokeMock).toHaveBeenCalledWith("load_diff_comments", {
    request: { identity },
  });
});

test("loadDiffCommentsはrequestと異なるdocument scopeを拒否する", async () => {
  invokeMock.mockReset();
  invokeMock.mockResolvedValue({
    ...document,
    worktreeId: `rw1_${"f".repeat(64)}`,
  });

  await expect(loadDiffComments({ identity })).rejects.toMatchObject({
    code: "invalidResponse",
  });
});

test("saveDiffCommentはCAS revisionとtargetを送る", async () => {
  const response = {
    kind: "committed",
    document: { ...document, revision: "1" },
    revision: "1",
    resolutionWarnings: [],
    durability: "durable",
  } as const;
  const request = {
    identity,
    expectedRevision: "0",
    target: { side: "current", newPath: "src/main.ts", line: 1 } as const,
    body: "review",
  };
  invokeMock.mockReset();
  invokeMock.mockResolvedValue(response);

  await expect(saveDiffComment(request)).resolves.toEqual(response);
  expect(invokeMock).toHaveBeenCalledWith("save_diff_comment", { request });
});

test("updateDiffCommentはcomment IDと部分更新を送る", async () => {
  const response = {
    kind: "preCommitFailure",
    code: "storeBusy",
    retryable: true,
  } as const;
  const request = {
    identity,
    expectedRevision: "1",
    commentId: "cmt_1",
    resolved: true,
  };
  invokeMock.mockReset();
  invokeMock.mockResolvedValue(response);

  await expect(updateDiffComment(request)).resolves.toEqual(response);
  expect(invokeMock).toHaveBeenCalledWith("update_diff_comment", { request });
});
