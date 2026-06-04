import { expect, test } from "vitest";

import { ReviewSession } from "@/features/review-runs/domain/reviewSession";
import type { ReviewRun } from "@/features/review-runs/types/reviewRun";

const activeRun = createReviewRun({
  id: "run-active",
  status: "active",
  archivedAt: null,
});

test("ReviewSession.fromDtoは非archived runをactive collection向けにnarrowする", () => {
  const entity = ReviewSession.fromDto(activeRun);

  expect(ReviewSession.isNonArchived(entity)).toBe(true);
  expect(ReviewSession.isArchived(entity)).toBe(false);
});

test("ReviewSession.fromDtoはarchived runをarchived variantへnarrowする", () => {
  const entity = ReviewSession.fromDto(
    createReviewRun({
      id: "run-archived",
      status: "archived",
      archivedAt: "2026-05-06T12:30:00Z",
    }),
  );

  expect(ReviewSession.isArchived(entity)).toBe(true);
});

test("ReviewSession.fromDtoはarchivedAtのないarchived runを拒否する", () => {
  const invalidRun = createReviewRun({
    id: "run-invalid-archived",
    status: "archived",
    archivedAt: null,
  });

  expect(() => ReviewSession.fromDto(invalidRun)).toThrow(
    "Archived review run must have archivedAt",
  );
});

test("ReviewSession.fromDtoはarchivedAtのある非archived runを拒否する", () => {
  const invalidRun = createReviewRun({
    id: "run-invalid-active",
    status: "completed",
    archivedAt: "2026-05-06T12:30:00Z",
  });

  expect(() => ReviewSession.fromDto(invalidRun)).toThrow(
    "Non-archived review run must not have archivedAt",
  );
});

function createReviewRun(
  input: Pick<ReviewRun, "archivedAt" | "id" | "status">,
): ReviewRun {
  return {
    id: input.id,
    status: input.status,
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
