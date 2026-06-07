import { expect, test } from "vitest";

import {
  mapListUserReviewsResponseToUserReviews,
  mapUserReviewDtoToUserReview,
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

test("mapUserReviewDtoToUserReviewはarchivedAtのないarchived reviewを拒否する", () => {
  const invalidReview = createUserReview({
    id: "review-invalid-archived",
    status: "archived",
    archivedAt: null,
  });

  expect(() => mapUserReviewDtoToUserReview(invalidReview)).toThrow(
    "Archived user review must have archivedAt",
  );
});

test("mapUserReviewDtoToUserReviewはarchivedAtのある非archived reviewを拒否する", () => {
  const invalidReview = createUserReview({
    id: "review-invalid-active",
    status: "completed",
    archivedAt: "2026-05-06T12:30:00Z",
  });

  expect(() => mapUserReviewDtoToUserReview(invalidReview)).toThrow(
    "Non-archived user review must not have archivedAt",
  );
});

test("mapListUserReviewsResponseToUserReviewsはvalid responseを保持する", () => {
  const response = {
    active: [activeReview],
    archived: [archivedReview],
    problems: [],
  };

  const mapped = mapListUserReviewsResponseToUserReviews(response);

  expect(mapped).toEqual(response);
  expect(mapped.active[0]).toBe(activeReview);
  expect(mapped.archived[0]).toBe(archivedReview);
});

test("mapListUserReviewsResponseToUserReviewsはactive内のarchive state不整合entryを拒否する", () => {
  const response = {
    active: [
      activeReview,
      createUserReview({
        id: "review-invalid-active-list-entry",
        status: "completed",
        archivedAt: "2026-05-06T12:30:00Z",
      }),
    ],
    archived: [archivedReview],
    problems: [],
  };

  expect(() => mapListUserReviewsResponseToUserReviews(response)).toThrow(
    "Non-archived user review must not have archivedAt: review-invalid-active-list-entry",
  );
});

test("mapListUserReviewsResponseToUserReviewsはarchived内のarchive state不整合entryを拒否する", () => {
  const response = {
    active: [activeReview],
    archived: [
      archivedReview,
      createUserReview({
        id: "review-invalid-archived-list-entry",
        status: "archived",
        archivedAt: null,
      }),
    ],
    problems: [],
  };

  expect(() => mapListUserReviewsResponseToUserReviews(response)).toThrow(
    "Archived user review must have archivedAt: review-invalid-archived-list-entry",
  );
});

test("mapListUserReviewsResponseToUserReviewsは最初のinvalid entryで拒否する", () => {
  const response = {
    active: [
      createUserReview({
        id: "review-invalid-first",
        status: "completed",
        archivedAt: "2026-05-06T12:30:00Z",
      }),
      createUserReview({
        id: "review-invalid-second",
        status: "archived",
        archivedAt: null,
      }),
    ],
    archived: [],
    problems: [],
  };

  expect(() => mapListUserReviewsResponseToUserReviews(response)).toThrow(
    "Non-archived user review must not have archivedAt: review-invalid-first",
  );
});

test("mapListUserReviewsResponseToUserReviewsはactive側のinvalid entryを先に拒否する", () => {
  const response = {
    active: [
      createUserReview({
        id: "review-invalid-active-first",
        status: "completed",
        archivedAt: "2026-05-06T12:30:00Z",
      }),
    ],
    archived: [
      createUserReview({
        id: "review-invalid-archived-second",
        status: "archived",
        archivedAt: null,
      }),
    ],
    problems: [],
  };

  expect(() => mapListUserReviewsResponseToUserReviews(response)).toThrow(
    "Non-archived user review must not have archivedAt: review-invalid-active-first",
  );
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
