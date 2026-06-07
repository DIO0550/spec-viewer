import { expect, test } from "vitest";

import {
  normalizeListUserReviewsResponse,
  normalizeUserReviewDto,
} from "@/features/review-runs/infra/userReviewIpcAdapter";
import type { UserReviewDto } from "@/features/review-runs/types/userReviewIpc";

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

test("normalizeUserReviewDtoはarchivedAtのないarchived reviewを拒否する", () => {
  const invalidReview = createUserReview({
    id: "review-invalid-archived",
    status: "archived",
    archivedAt: null,
  });

  expect(() => normalizeUserReviewDto(invalidReview)).toThrow(
    "Archived user review must have archivedAt",
  );
});

test("normalizeUserReviewDtoはarchivedAtのある非archived reviewを拒否する", () => {
  const invalidReview = createUserReview({
    id: "review-invalid-active",
    status: "completed",
    archivedAt: "2026-05-06T12:30:00Z",
  });

  expect(() => normalizeUserReviewDto(invalidReview)).toThrow(
    "Non-archived user review must not have archivedAt",
  );
});

test("normalizeListUserReviewsResponseはvalid responseを保持する", () => {
  const response = {
    active: [activeReview],
    archived: [archivedReview],
    problems: [],
  };

  expect(normalizeListUserReviewsResponse(response)).toEqual(response);
});

function createUserReview(
  input: Pick<UserReviewDto, "archivedAt" | "id" | "status">,
): UserReviewDto {
  return {
    id: input.id,
    status: input.status,
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
  } as UserReviewDto;
}
