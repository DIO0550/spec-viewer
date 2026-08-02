import { invoke } from "@tauri-apps/api/core";
import { expect, test, vi } from "vitest";

import { getSpecFileDiff } from "@/lib/api/tauri/getSpecFileDiff";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

const invokeMock = vi.mocked(invoke);

import { createMinimalDetailResponse } from "./specDiffTestFixtures";

const createDetailResponse = () => {
  const response = createMinimalDetailResponse();
  response.review.structuredDiff.hunks = [
    {
      header: "@@ -0,0 +1 @@",
      lines: [{ kind: "added", text: "# Tasks" }],
    },
  ];
  return response;
};

test("getSpecFileDiffはdetail commandへ5 fieldを渡してdomainへdecodeする", async () => {
  invokeMock.mockReset();
  invokeMock.mockResolvedValue(createDetailResponse());

  const result = await getSpecFileDiff({
    workspacePath: "/workspace",
    currentSnapshotId: "rs1_snapshot",
    specId: "077-issue-166",
    fileKey: "tasks",
    path: ".plugin-workspace/.specs/077-issue-166/tasks.md",
  });

  expect(result.review.structuredDiff).toEqual({
    state: "available",
    hunks: [
      {
        header: "@@ -0,0 +1 @@",
        lines: [
          {
            kind: "added",
            text: "# Tasks",
            oldLineNumber: null,
            newLineNumber: 1,
          },
        ],
      },
    ],
    reason: null,
  });
  expect(invokeMock).toHaveBeenCalledOnce();
  expect(invokeMock).toHaveBeenCalledWith("get_spec_file_diff", {
    request: {
      workspacePath: "/workspace",
      currentSnapshotId: "rs1_snapshot",
      specId: "077-issue-166",
      fileKey: "tasks",
      path: ".plugin-workspace/.specs/077-issue-166/tasks.md",
    },
  });
});

test("getSpecFileDiffはstructured diff omittedを正常responseとして返す", async () => {
  const response = createDetailResponse();
  response.review.structuredDiff = {
    state: "omitted",
    hunks: [],
    reason: "diffLimit",
  };
  invokeMock.mockReset();
  invokeMock.mockResolvedValue(response);

  const result = await getSpecFileDiff({
    workspacePath: "/workspace",
    currentSnapshotId: "rs1_snapshot",
    specId: "077-issue-166",
    fileKey: "tasks",
    path: "tasks.md",
  });

  expect(result.review.structuredDiff).toEqual(response.review.structuredDiff);
});

test("getSpecFileDiffはBackend rejectをcommand errorとして保持する", async () => {
  const raw = { code: "staleSnapshot", message: "snapshot changed" };
  invokeMock.mockReset();
  invokeMock.mockRejectedValue(raw);

  await expect(
    getSpecFileDiff({
      workspacePath: "/workspace",
      currentSnapshotId: "stale",
      specId: "077-issue-166",
      fileKey: "tasks",
      path: "tasks.md",
    }),
  ).rejects.toEqual({
    command: "get_spec_file_diff",
    code: "staleSnapshot",
    message: "snapshot changed",
    raw,
  });
});

test("getSpecFileDiffはresolved不正payloadをinvalidResponseとして保持する", async () => {
  const raw = { specId: "077-issue-166", fileKey: "tasks" };
  invokeMock.mockReset();
  invokeMock.mockResolvedValue(raw);

  await expect(
    getSpecFileDiff({
      workspacePath: "/workspace",
      currentSnapshotId: "rs1_snapshot",
      specId: "077-issue-166",
      fileKey: "tasks",
      path: "tasks.md",
    }),
  ).rejects.toEqual({
    command: "get_spec_file_diff",
    code: "invalidResponse",
    message: "review must be an object: received a non-object value",
    raw,
  });
});
