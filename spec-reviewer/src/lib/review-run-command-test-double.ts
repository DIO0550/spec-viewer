import type { ReviewRunCommands } from "./tauri";
import type {
  CreateReviewRunRequest,
  CreateReviewRunResponse,
  ListReviewRunsRequest,
  ListReviewRunsResponse,
  ReviewRun,
} from "../types/reviewRun";

export type ReviewRunCommandTestDoubleResponses = Readonly<{
  createReviewRun?: CreateReviewRunResponse;
  listReviewRuns?: ListReviewRunsResponse;
}>;

export type ReviewRunCommandTestDoubleCalls = Readonly<{
  createReviewRun: readonly CreateReviewRunRequest[];
  listReviewRuns: readonly ListReviewRunsRequest[];
}>;

export type ReviewRunCommandTestDouble = Readonly<{
  commands: ReviewRunCommands;
  calls: ReviewRunCommandTestDoubleCalls;
}>;

const defaultReviewRun: ReviewRun = {
  id: "2026-05-06T120000Z-file-tasks-abcdef12",
  status: "active",
  target: {
    scope: "file",
    specId: "auth",
    fileKey: "tasks",
  },
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
};

/** @returns A typed review run command double for hook and component tests. */
export function createReviewRunCommandTestDouble(
  responses: ReviewRunCommandTestDoubleResponses = {},
): ReviewRunCommandTestDouble {
  const createReviewRunCalls: CreateReviewRunRequest[] = [];
  const listReviewRunsCalls: ListReviewRunsRequest[] = [];

  return {
    calls: {
      createReviewRun: createReviewRunCalls,
      listReviewRuns: listReviewRunsCalls,
    },
    commands: {
      createReviewRun: async (request) => {
        createReviewRunCalls.push(request);
        return responses.createReviewRun ?? { reviewRun: defaultReviewRun };
      },
      listReviewRuns: async (request) => {
        listReviewRunsCalls.push(request);
        return (
          responses.listReviewRuns ?? {
            active: [defaultReviewRun],
            archived: [],
          }
        );
      },
    },
  };
}
