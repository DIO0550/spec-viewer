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
  schemaVersion: "spec-reviewer.user-review.v1",
  id: "urv_0123456789abcdef0123456789abcdef",
  status: "active",
  target: {
    scope: "file",
    specId: "auth-flow",
    fileKey: "tasks",
  },
  recordLocator: "urv_0123456789abcdef0123456789abcdef.json",
  commentCount: 1,
  createdAt: "2026-05-06T12:00:00Z",
  updatedAt: "2026-05-06T12:00:00Z",
  archivedAt: null,
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
              updatedAt: "2026-05-06T12:30:00Z",
              archivedAt: "2026-05-06T12:30:00Z",
            },
          }
        );
      },
    },
  };
}
