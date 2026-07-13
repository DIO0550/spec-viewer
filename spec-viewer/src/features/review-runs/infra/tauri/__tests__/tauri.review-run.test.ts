import * as TestValues from "@/features/review-runs/testing/validatedValueObjects";
import { invoke } from "@tauri-apps/api/core";
import { expect, test, vi } from "vitest";

import type {
  ArchiveUserReviewRequest,
  ArchiveUserReviewResponse,
  CreateUserReviewRequest,
  CreateUserReviewResponse,
  ListUserReviewsRequest,
  ListUserReviewsResponse,
} from "@/features/review-runs/types/userReviewIpc";
import {
  archiveUserReview,
  createUserReview,
  listUserReviews,
} from "@/features/review-runs/infra/tauri";
import { ArchiveUserReviewCommandError } from "@/features/review-runs/infra/tauri/archiveUserReview";
import { CreateUserReviewCommandError } from "@/features/review-runs/infra/tauri/createUserReview";
import { ListUserReviewsCommandError } from "@/features/review-runs/infra/tauri/listUserReviews";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

const invokeMock = vi.mocked(invoke);
const commentId = TestValues.commentId;

const request: CreateUserReviewRequest = {
  workspacePath: "/workspace/spec-reviewer",
  target: {
    scope: "file",
    specId: TestValues.specId("auth"),
    fileKey: "tasks",
  },
  commentIds: [commentId("cmt_1")],
  workspaceMode: "currentWorkspace",
};

const response: CreateUserReviewResponse = {
  userReview: {
    id: TestValues.userReviewId("2026-05-06T120000Z-file-tasks-abcdef12"),
    status: "active",
    target: request.target,
    workspace: {
      mode: "currentWorkspace",
      workspacePath: "/workspace/spec-reviewer",
    },
    specFolderPath: "/workspace/spec-reviewer/.plugin-workspace/.specs/auth",
    folderPath:
      "/workspace/spec-reviewer/.plugin-workspace/.specs/auth/user-review/active/2026-05-06T120000Z-file-tasks-abcdef12",
    sourceFiles: [
      {
        specId: TestValues.specId("auth"),
        fileKey: "tasks",
        relativePath: ".plugin-workspace/.specs/auth/tasks.md",
      },
    ],
    commentCount: 1,
    createdAt: TestValues.isoDateTime("2026-05-06T12:00:00Z"),
    archivedAt: null,
    summary: null,
    warnings: [],
  },
};

const listRequest: ListUserReviewsRequest = {
  workspacePath: "/workspace/spec-reviewer",
  target: request.target,
};

const listResponse: ListUserReviewsResponse = {
  active: [response.userReview],
  archived: [],
  problems: [],
};

const archiveRequest: ArchiveUserReviewRequest = {
  workspacePath: "/workspace/spec-reviewer",
  target: request.target,
  userReviewId: response.userReview.id,
};

const archiveResponse: ArchiveUserReviewResponse = {
  userReview: {
    ...response.userReview,
    status: "archived",
    folderPath:
      "/workspace/spec-reviewer/.plugin-workspace/.specs/auth/user-review/archive/2026-05-06T120000Z-file-tasks-abcdef12",
    archivedAt: TestValues.isoDateTime("2026-05-06T12:30:00Z"),
    summary: "対応完了",
  },
};

test("createUserReviewはcreate_user_reviewへrequestを渡す", async () => {
  invokeMock.mockReset();
  invokeMock.mockResolvedValue(response);

  const result = await createUserReview(request);

  expect(result.userReview.id).toBe(response.userReview.id);
  expect(invokeMock).toHaveBeenCalledWith("create_user_review", {
    request,
  });
});

test("CreateUserReviewCommandErrorはinvalidSpecを保持する", () => {
  const rawError = {
    code: "invalidSpec",
    message: "invalid review run target spec",
  };

  const result = CreateUserReviewCommandError.fromUnknown(rawError);

  expect(result).toEqual({
    command: "create_user_review",
    code: "invalidSpec",
    message: "invalid review run target spec",
    cause: rawError,
  });
});

test("CreateUserReviewCommandError.fromUnknownは正規化済みunknownエラーのmessageを保持する", () => {
  const normalizedError = CreateUserReviewCommandError.unknown(
    "review bundle could not be created",
    { cause: "export failed" },
  );

  expect(CreateUserReviewCommandError.fromUnknown(normalizedError)).toEqual(
    normalizedError,
  );
});

test("listUserReviewsはlist_user_reviewsへrequestを渡す", async () => {
  invokeMock.mockReset();
  invokeMock.mockResolvedValue(listResponse);

  const result = await listUserReviews(listRequest);

  expect(result.active).toEqual([response.userReview]);
  expect(invokeMock).toHaveBeenCalledWith("list_user_reviews", {
    request: listRequest,
  });
});

test("ListUserReviewsCommandErrorはinvalidSpecを保持する", () => {
  const rawError = {
    code: "invalidSpec",
    message: "invalid review run target spec",
  };

  const result = ListUserReviewsCommandError.fromUnknown(rawError);

  expect(result).toEqual({
    command: "list_user_reviews",
    code: "invalidSpec",
    message: "invalid review run target spec",
    cause: rawError,
  });
});

test("ListUserReviewsCommandError.fromUnknownは正規化済みunknownエラーのmessageを保持する", () => {
  const normalizedError = ListUserReviewsCommandError.unknown(
    "review runs could not be listed",
    { cause: "scan failed" },
  );

  expect(ListUserReviewsCommandError.fromUnknown(normalizedError)).toEqual(
    normalizedError,
  );
});

test("archiveUserReviewはarchive_user_reviewへrequestを渡す", async () => {
  invokeMock.mockReset();
  invokeMock.mockResolvedValue(archiveResponse);

  const result = await archiveUserReview(archiveRequest);

  expect(result.userReview.status).toBe("archived");
  expect(invokeMock).toHaveBeenCalledWith("archive_user_review", {
    request: archiveRequest,
  });
});

test("ArchiveUserReviewCommandErrorはinvalidSpecを保持する", () => {
  const rawError = {
    code: "invalidSpec",
    message: "invalid review run target spec",
  };

  const result = ArchiveUserReviewCommandError.fromUnknown(rawError);

  expect(result).toEqual({
    command: "archive_user_review",
    code: "invalidSpec",
    message: "invalid review run target spec",
    cause: rawError,
  });
});

test("ArchiveUserReviewCommandError.fromUnknownは正規化済みunknownエラーのmessageを保持する", () => {
  const normalizedError = ArchiveUserReviewCommandError.unknown(
    "review run could not be archived",
    { cause: "archive failed" },
  );

  expect(ArchiveUserReviewCommandError.fromUnknown(normalizedError)).toEqual(
    normalizedError,
  );
});

test("createUserReviewは矛盾するarchived statusをstructured decode errorとして拒否する", async () => {
  invokeMock.mockReset();
  invokeMock.mockResolvedValue({
    userReview: {
      ...response.userReview,
      status: "archived",
      archivedAt: null,
    },
  });

  await expect(createUserReview(request)).rejects.toMatchObject({
    command: "create_user_review",
    code: "invalidResponse",
    path: "$.userReview.archivedAt",
  });
});

test("createUserReviewは不正なreview IDをVO path付きdecode errorとして拒否する", async () => {
  invokeMock.mockReset();
  invokeMock.mockResolvedValue({
    userReview: { ...response.userReview, id: "review-active" },
  });

  await expect(createUserReview(request)).rejects.toMatchObject({
    command: "create_user_review",
    code: "invalidResponse",
    path: "$.userReview.id",
    expected: "valid UserReviewId",
    actual: "review-active",
  });
});
