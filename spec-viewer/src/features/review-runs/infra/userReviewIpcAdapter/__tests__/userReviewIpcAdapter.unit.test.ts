import { expect, test } from "vitest";

import {
  mapListUserReviewsResponseToUserReviews,
  mapUserReviewDtoToUserReview,
} from "@/features/review-runs/infra/userReviewIpcAdapter";
import type { UserReviewDto } from "@/features/review-runs/infra/tauri/userReviewIpcCodec";

const activeReview = createUserReview({
  id: "review-active",
  status: "active",
  archivedAt: null,
});
const archivedReview = createUserReview({
  id: "review-archived",
  status: "archived",
  archivedAt: "2026-05-06T12:30:00Z",
});

test("review DTO adapterはarchivedAtのないarchived reviewをstructured errorで拒否する", () => {
  const invalidReview = createUserReview({
    id: "review-invalid-archived",
    status: "archived",
    archivedAt: null,
  });

  expect(() => mapUserReviewDtoToUserReview(invalidReview)).toThrowError(
    expect.objectContaining({
      command: "user_review_adapter",
      code: "invalidResponse",
      path: "$.archivedAt",
    }),
  );
});

test("review DTO adapterはarchivedAtのある非archived reviewをstructured errorで拒否する", () => {
  const invalidReview = createUserReview({
    id: "review-invalid-active",
    status: "completed",
    archivedAt: "2026-05-06T12:30:00Z",
  });

  expect(() => mapUserReviewDtoToUserReview(invalidReview)).toThrowError(
    expect.objectContaining({
      command: "user_review_adapter",
      code: "invalidResponse",
      path: "$.archivedAt",
    }),
  );
});

test("review DTO adapterはvalid list responseをdomain responseへ復元する", () => {
  const response = {
    active: [activeReview],
    archived: [archivedReview],
    problems: [],
  };

  expect(mapListUserReviewsResponseToUserReviews(response)).toEqual(response);
});

function createUserReview(
  input: Pick<UserReviewDto, "archivedAt" | "id" | "status">,
): UserReviewDto {
  return {
    id: input.id,
    status: input.status,
    target: { scope: "file", specId: "auth", fileKey: "tasks" },
    workspace: {
      mode: "currentWorkspace",
      workspacePath: "/workspace/spec-reviewer",
    },
    specFolderPath: "/workspace/spec-reviewer/.plugin-workspace/.specs/auth",
    folderPath: `/workspace/spec-reviewer/.plugin-workspace/.specs/auth/user-review/active/${input.id}`,
    sourceFiles: [
      {
        specId: "auth",
        fileKey: "tasks",
        relativePath: ".plugin-workspace/.specs/auth/tasks.md",
      },
    ],
    commentCount: 1,
    createdAt: "2026-05-06T12:00:00Z",
    archivedAt: input.archivedAt,
    summary: null,
    warnings: [],
  };
}
