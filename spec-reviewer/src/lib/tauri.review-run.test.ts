import { invoke } from "@tauri-apps/api/core";
import { expect, test, vi } from "vitest";

import type {
  CreateReviewRunRequest,
  CreateReviewRunResponse,
} from "../types/reviewRun";
import { createReviewRun, normalizeCommandError } from "./tauri";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

const invokeMock = vi.mocked(invoke);

const request: CreateReviewRunRequest = {
  workspacePath: "/workspace/spec-reviewer",
  target: {
    scope: "file",
    specId: "auth",
    fileKey: "tasks",
  },
  commentIds: ["cmt_1"],
  executionMode: "currentWorkspace",
};

const response: CreateReviewRunResponse = {
  reviewRun: {
    id: "2026-05-06T120000Z-file-tasks-abcdef12",
    status: "active",
    target: request.target,
    executionTarget: {
      mode: "currentWorkspace",
      workspacePath: "/workspace/spec-reviewer",
    },
    specFolderPath: "/workspace/spec-reviewer/.plugin-workspace/.specs/auth",
    folderPath:
      "/workspace/spec-reviewer/.plugin-workspace/.specs/auth/user-review/active/2026-05-06T120000Z-file-tasks-abcdef12",
    commentCount: 1,
    createdAt: "2026-05-06T12:00:00Z",
    archivedAt: null,
  },
};

test("createReviewRunはcreate_review_runへrequestを渡す", async () => {
  invokeMock.mockReset();
  invokeMock.mockResolvedValue(response);

  const result = await createReviewRun(request);

  expect(result.reviewRun.id).toBe(response.reviewRun.id);
  expect(invokeMock).toHaveBeenCalledWith("create_review_run", {
    request,
  });
});

test("normalizeCommandErrorはreview run exportエラーを保持する", () => {
  const rawError = {
    code: "reviewRunExport",
    message: "failed to export review run",
  };

  const result = normalizeCommandError(rawError);

  expect(result).toEqual({
    code: "reviewRunExport",
    message: "failed to export review run",
    raw: rawError,
  });
});
