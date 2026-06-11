import type {
  ArchiveUserReviewRequest,
  ArchiveUserReviewResponse,
  CreateUserReviewRequest,
  CreateUserReviewResponse,
  ListUserReviewsRequest,
  ListUserReviewsResponse,
  UserReview,
} from "@/features/review-runs/types/userReviewIpc";
import type { UserReviewCommands } from "@/shared/api/tauri";

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
  id: "2026-05-06T120000Z-file-tasks-abcdef12",
  status: "active",
  target: {
    scope: "file",
    specId: "auth",
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
      /**
       * Records the call and returns the stubbed create response.
       * @param request - Create user review request to record.
       */
      createUserReview: async (request) => {
        createUserReviewCalls.push(request);
        return responses.createUserReview ?? { userReview: defaultUserReview };
      },
      /**
       * Records the call and returns the stubbed list response.
       * @param request - List user reviews request to record.
       */
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
      /**
       * Records the call and returns the stubbed archive response.
       * @param request - Archive user review request to record.
       */
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
              archivedAt: "2026-05-06T12:30:00Z",
            },
          }
        );
      },
    },
  };
}
