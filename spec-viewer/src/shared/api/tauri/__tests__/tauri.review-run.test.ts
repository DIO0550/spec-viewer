import { invoke } from "@tauri-apps/api/core";
import { expect, test, vi } from "vitest";

import type {
  ArchiveReviewRunRequest,
  ArchiveReviewRunResponse,
  CreateReviewRunRequest,
  CreateReviewRunResponse,
  ListReviewRunsRequest,
  ListReviewRunsResponse,
} from "@/features/review-runs/types/reviewRun";
import {
  archiveReviewRun,
  createReviewRun,
  listReviewRuns,
  normalizeCommandError,
} from "@/shared/api/tauri";
import { CommentId } from "@/features/comments/types/comment";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

const invokeMock = vi.mocked(invoke);
const commentId = CommentId.fromString;

const request: CreateReviewRunRequest = {
  workspacePath: "/workspace/spec-reviewer",
  target: {
    scope: "file",
    specId: "auth",
    fileKey: "tasks",
  },
  commentIds: [commentId("cmt_1")],
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
    sourceFiles: [
      {
        specId: "auth",
        fileKey: "tasks",
        relativePath: ".plugin-workspace/.specs/auth/tasks.md",
      },
    ],
    commentCount: 1,
    createdAt: "2026-05-06T12:00:00Z",
    archivedAt: null,
    summary: null,
    warnings: [],
  },
};

const listRequest: ListReviewRunsRequest = {
  workspacePath: "/workspace/spec-reviewer",
  target: request.target,
};

const listResponse: ListReviewRunsResponse = {
  active: [response.reviewRun],
  archived: [],
  problems: [],
};

const archiveRequest: ArchiveReviewRunRequest = {
  workspacePath: "/workspace/spec-reviewer",
  target: request.target,
  reviewRunId: response.reviewRun.id,
};

const archiveResponse: ArchiveReviewRunResponse = {
  reviewRun: {
    ...response.reviewRun,
    status: "archived",
    folderPath:
      "/workspace/spec-reviewer/.plugin-workspace/.specs/auth/user-review/archive/2026-05-06T120000Z-file-tasks-abcdef12",
    archivedAt: "2026-05-06T12:30:00Z",
    summary: "対応完了",
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

test("listReviewRunsはlist_review_runsへrequestを渡す", async () => {
  invokeMock.mockReset();
  invokeMock.mockResolvedValue(listResponse);

  const result = await listReviewRuns(listRequest);

  expect(result.active).toEqual([response.reviewRun]);
  expect(invokeMock).toHaveBeenCalledWith("list_review_runs", {
    request: listRequest,
  });
});

test("archiveReviewRunはarchive_review_runへrequestを渡す", async () => {
  invokeMock.mockReset();
  invokeMock.mockResolvedValue(archiveResponse);

  const result = await archiveReviewRun(archiveRequest);

  expect(result.reviewRun.status).toBe("archived");
  expect(invokeMock).toHaveBeenCalledWith("archive_review_run", {
    request: archiveRequest,
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
