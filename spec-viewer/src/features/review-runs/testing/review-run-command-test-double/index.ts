import type {
  ArchiveUserReviewRequest,
  ArchiveUserReviewResponse,
  CreateUserReviewRequest,
  CreateUserReviewResponse,
  ListUserReviewsRequest,
  ListUserReviewsResponse,
  UserReview,
} from "@/features/review-runs/types/userReviewIpc";
import type { UserReviewCommands } from "@/features/review-runs/application/ports/userReviewCommands";
import {
  isoDateTime,
  specId,
  userReviewId,
} from "@/shared/testing/validatedValueObjects";

const authSpecId = specId("auth");

export type UserReviewCommandTestDoubleResponses = Readonly<{
  createUserReview?: CreateUserReviewResponse;
  listUserReviews?: ListUserReviewsResponse;
  archiveUserReview?: ArchiveUserReviewResponse;
}>;

export type UserReviewCommandTestDoubleCalls = Readonly<{
  createUserReview: readonly CreateUserReviewRequest[];
  listUserReviews: readonly ListUserReviewsRequest[];
  archiveUserReview: readonly ArchiveUserReviewRequest[];
}>;

export type UserReviewCommandTestDouble = Readonly<{
  commands: UserReviewCommands;
  calls: UserReviewCommandTestDoubleCalls;
}>;

const defaultUserReview: UserReview = {
  id: userReviewId("2026-05-06T120000Z-file-tasks-abcdef12"),
  status: "active",
  target: {
    scope: "file",
    specId: authSpecId,
    fileKey: "tasks",
  },
  workspace: {
    mode: "currentWorkspace",
    workspacePath: "/workspace/spec-reviewer",
  },
  specFolderPath: "/workspace/spec-reviewer/.plugin-workspace/.specs/auth",
  folderPath:
    "/workspace/spec-reviewer/.plugin-workspace/.specs/auth/user-review/active/2026-05-06T120000Z-file-tasks-abcdef12",
  sourceFiles: [
    {
      specId: authSpecId,
      fileKey: "tasks",
      relativePath: ".plugin-workspace/.specs/auth/tasks.md",
    },
  ],
  commentCount: 1,
  createdAt: isoDateTime("2026-05-06T12:00:00Z"),
  archivedAt: null,
  summary: null,
  warnings: [],
};

/** @returns A typed review run command double for hook and component tests. */
export function createUserReviewCommandTestDouble(
  responses: UserReviewCommandTestDoubleResponses = {},
): UserReviewCommandTestDouble {
  const createUserReviewCalls: CreateUserReviewRequest[] = [];
  const listUserReviewsCalls: ListUserReviewsRequest[] = [];
  const archiveUserReviewCalls: ArchiveUserReviewRequest[] = [];

  return {
    calls: {
      createUserReview: createUserReviewCalls,
      listUserReviews: listUserReviewsCalls,
      archiveUserReview: archiveUserReviewCalls,
    },
    commands: {
      /** Records and answers a create call. @param request - The create request. */
      createUserReview: async (request) => {
        createUserReviewCalls.push(request);
        return responses.createUserReview ?? { userReview: defaultUserReview };
      },
      /** Records and answers a list call. @param request - The list request. */
      listUserReviews: async (request) => {
        listUserReviewsCalls.push(request);
        return (
          responses.listUserReviews ?? {
            active: [defaultUserReview],
            archived: [],
            problems: [],
          }
        );
      },
      /** Records and answers an archive call. @param request - The archive request. */
      archiveUserReview: async (request) => {
        archiveUserReviewCalls.push(request);
        return (
          responses.archiveUserReview ?? {
            userReview: {
              ...defaultUserReview,
              status: "archived",
              folderPath: defaultUserReview.folderPath.replace(
                "/active/",
                "/archive/",
              ),
              archivedAt: isoDateTime("2026-05-06T12:30:00Z"),
            },
          }
        );
      },
    },
  };
}
